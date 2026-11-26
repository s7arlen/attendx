/**
 * Facial Recognition Service
 * Handles face detection, landmark telemetry, active liveness verification, and descriptor extraction.
 */

import * as faceapi from 'face-api.js'
import type { LivenessAction, LivenessFrameTelemetry } from '@/types'

const MODEL_URL =
  import.meta.env.VITE_FACE_API_URL ||
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.20.0/weights'

let initPromise: Promise<void> | null = null

// Initialize face-api models (cached across openings; retries cleanly on failure)
export const initializeFaceAPI = async () => {
  if (!initPromise) {
    initPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.load(MODEL_URL),
      faceapi.nets.faceLandmark68Net.load(MODEL_URL),
      faceapi.nets.faceRecognitionNet.load(MODEL_URL),
    ])
      .then(() => undefined)
      .catch((error) => {
        initPromise = null
        console.error('Failed to load face-api models:', error)
        throw new Error('Facial recognition models failed to load. Please check your connection and try again.')
      })
  }
  return initPromise
}

export interface FaceDescriptor {
  descriptor: number[]
  timestamp: number
}

interface Point2D {
  x: number
  y: number
}

const ptDist = (a: Point2D, b: Point2D): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

export const computeEAR = (positions: Point2D[]): number => {
  const eyeEAR = (offset: number) => {
    const p0 = positions[offset]
    const p1 = positions[offset + 1]
    const p2 = positions[offset + 2]
    const p3 = positions[offset + 3]
    const p4 = positions[offset + 4]
    const p5 = positions[offset + 5]
    const horiz = Math.max(1e-3, ptDist(p0, p3))
    return (ptDist(p1, p5) + ptDist(p2, p4)) / (2 * horiz)
  }
  return (eyeEAR(36) + eyeEAR(42)) / 2
}

export const computeMAR = (positions: Point2D[]): number => {
  const p48 = positions[48]
  const p54 = positions[54]
  const p50 = positions[50]
  const p58 = positions[58]
  const p52 = positions[52]
  const p56 = positions[56]
  const horiz = Math.max(1e-3, ptDist(p48, p54))
  return (ptDist(p50, p58) + ptDist(p52, p56)) / (2 * horiz)
}

export const computeYawRatio = (positions: Point2D[]): number => {
  const jawLeft = positions[0]
  const jawRight = positions[16]
  const noseTip = positions[30]
  const span = Math.max(1e-3, jawRight.x - jawLeft.x)
  return (noseTip.x - jawLeft.x) / span
}

export const captureSnapshotJpeg = (
  videoEl: HTMLVideoElement,
  canvasEl?: HTMLCanvasElement | null
): string => {
  const canvas = canvasEl || document.createElement('canvas')
  const w = 320
  const h = 240
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to acquire 2D canvas context')
  ctx.drawImage(videoEl, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.72)
}

export interface DetectedFaceSample {
  ear: number
  mar: number
  yawRatio: number
  descriptor: number[]
  snapshotBase64: string
  timestampMs: number
}

export const detectLiveFaceSample = async (
  videoRef: HTMLVideoElement,
  canvasRef?: HTMLCanvasElement | null
): Promise<DetectedFaceSample> => {
  if (!videoRef || videoRef.readyState < 2 || videoRef.videoWidth === 0) {
    throw new Error('Camera feed is still starting. Please wait a moment and try again.')
  }

  const detections = await faceapi
    .detectAllFaces(videoRef, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (detections.length === 0) {
    throw new Error('No face detected. Keep your face centered inside the frame.')
  }
  if (detections.length > 1) {
    throw new Error('Multiple faces detected. Ensure only you are in the frame.')
  }

  const d = detections[0]
  const positions = d.landmarks.positions
  const snapshotBase64 = captureSnapshotJpeg(videoRef, canvasRef)

  return {
    ear: Number(computeEAR(positions).toFixed(4)),
    mar: Number(computeMAR(positions).toFixed(4)),
    yawRatio: Number(computeYawRatio(positions).toFixed(4)),
    descriptor: Array.from(d.descriptor),
    snapshotBase64,
    timestampMs: Date.now(),
  }
}

export const isLivenessActionSatisfied = (
  action: LivenessAction,
  baseline: Pick<LivenessFrameTelemetry, 'ear' | 'mar' | 'yawRatio'>,
  sample: Pick<LivenessFrameTelemetry, 'ear' | 'mar' | 'yawRatio'>
): boolean => {
  switch (action) {
    case 'blink':
      return sample.ear <= 0.21 && (baseline.ear - sample.ear >= 0.03 || sample.ear <= 0.17)
    case 'open_mouth':
      return sample.mar >= 0.36 && sample.mar - baseline.mar >= 0.10
    case 'turn_left':
      return sample.yawRatio - baseline.yawRatio >= 0.07
    case 'turn_right':
      return baseline.yawRatio - sample.yawRatio >= 0.07
    default:
      return false
  }
}

/**
 * Capture and extract face descriptor from video stream
 */
export const captureFaceDescriptor = async (videoRef: HTMLVideoElement): Promise<Float32Array | null> => {
  if (!videoRef) return null
  if (videoRef.readyState < 2 || videoRef.videoWidth === 0) {
    throw new Error('Camera feed is still starting. Please wait a moment and try again.')
  }

  const detections = await faceapi
    .detectAllFaces(videoRef, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (detections.length === 0) {
    throw new Error('No face detected. Please ensure your face is clearly visible.')
  }

  if (detections.length > 1) {
    throw new Error('Multiple faces detected. Please ensure only your face is in the frame.')
  }

  return detections[0].descriptor
}

export const calculateSimilarity = (descriptor1: Float32Array, descriptor2: Float32Array): number => {
  if (descriptor1.length !== descriptor2.length) {
    throw new Error('Descriptors must have the same length')
  }

  let sumSquaredDiff = 0
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i]
    sumSquaredDiff += diff * diff
  }

  const euclideanDistance = Math.sqrt(sumSquaredDiff)
  const similarity = Math.max(0, 1 - euclideanDistance / 1.2)
  return Math.min(1, similarity)
}

export const verifyFace = (
  capturedDescriptor: Float32Array,
  storedDescriptor: Float32Array,
  threshold: number = 0.65
): boolean => {
  const similarity = calculateSimilarity(capturedDescriptor, storedDescriptor)
  return similarity >= threshold
}

export const serializeDescriptor = (descriptor: Float32Array): number[] => {
  return Array.from(descriptor)
}

export const deserializeDescriptor = (arr: number[]): Float32Array => {
  return new Float32Array(arr)
}

export const captureFaceDescriptors = async (
  videoRef: HTMLVideoElement,
  count: number = 3,
  delayMs: number = 500
): Promise<Float32Array[]> => {
  const descriptors: Float32Array[] = []

  for (let i = 0; i < count; i++) {
    try {
      const descriptor = await captureFaceDescriptor(videoRef)
      if (descriptor) {
        descriptors.push(descriptor)
      }
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    } catch (error) {
      if (i === 0) throw error
    }
  }

  if (descriptors.length === 0) {
    throw new Error('Failed to capture face descriptors')
  }

  return descriptors
}

export const averageDescriptors = (descriptors: Float32Array[]): Float32Array => {
  if (descriptors.length === 0) {
    throw new Error('No descriptors to average')
  }

  const length = descriptors[0].length
  const averaged = new Float32Array(length)

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (const descriptor of descriptors) {
      sum += descriptor[i]
    }
    averaged[i] = sum / descriptors.length
  }

  return averaged
}
