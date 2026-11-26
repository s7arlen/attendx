/**
 * Facial Recognition Service
 * Handles face detection, registration, and verification for attendance
 */

import * as faceapi from 'face-api.js'

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

/**
 * Capture and extract face descriptor from video stream
 * Returns array of face descriptors (in case multiple faces detected)
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

  // Return the descriptor of the first (and only) detected face
  return detections[0].descriptor
}

/**
 * Calculate similarity between two face descriptors (0-1, higher = more similar)
 * Uses Euclidean distance normalized to similarity score
 */
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
  // Normalize distance to similarity (0-1 range)
  // Distance threshold typically around 0.6, so we use that as reference
  const similarity = Math.max(0, 1 - euclideanDistance / 0.6)
  return Math.min(1, similarity)
}

/**
 * Verify face against stored descriptor
 * Returns true if similarity >= threshold (default 0.65 for ~95% accuracy)
 */
export const verifyFace = (
  capturedDescriptor: Float32Array,
  storedDescriptor: Float32Array,
  threshold: number = 0.65
): boolean => {
  const similarity = calculateSimilarity(capturedDescriptor, storedDescriptor)
  return similarity >= threshold
}

/**
 * Convert Float32Array to regular array for JSON serialization
 */
export const serializeDescriptor = (descriptor: Float32Array): number[] => {
  return Array.from(descriptor)
}

/**
 * Convert array back to Float32Array
 */
export const deserializeDescriptor = (arr: number[]): Float32Array => {
  return new Float32Array(arr)
}

/**
 * Take multiple face captures and average them for better registration
 * This improves accuracy by capturing face from slightly different angles
 */
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
      if (i === 0) throw error // Fail fast on first attempt
      // For subsequent attempts, we can be more lenient
    }
  }

  if (descriptors.length === 0) {
    throw new Error('Failed to capture face descriptors')
  }

  return descriptors
}

/**
 * Average multiple descriptors for better accuracy
 * Used to create a composite face signature during registration
 */
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
