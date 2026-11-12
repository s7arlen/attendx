import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { ApiError } from '@/types'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { generateAvatarUrl } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

export default function AvatarUpload() {
  const { user, updateUser } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    try {
      const avatarUrl = await authService.uploadAvatar(file)
      // Update stored user avatar so it reflects everywhere
      updateUser({ avatar: avatarUrl })
      toast({ title: 'Photo updated', variant: 'success' })
    } catch (err) {
      const error = err as ApiError
      setPreview(null)
      toast({
        title: 'Upload failed',
        description: error.response?.data?.message || 'Max 2 MB. JPG, PNG or WebP only.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      URL.revokeObjectURL(objectUrl)
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const src = preview || user?.avatar || generateAvatarUrl(user?.name || 'User')

  return (
    <div className="relative w-fit">
      <img
        src={src}
        alt={user?.name}
        className="w-20 h-20 rounded-2xl ring-2 ring-primary/20 object-cover"
      />

      {/* Upload overlay button */}
      <button
        type="button"
        aria-label="Change profile photo"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-primary text-white
          flex items-center justify-center shadow-lg hover:bg-primary/90
          transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {uploading
          ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          : <Camera className="w-4 h-4" aria-hidden="true" />
        }
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
        aria-label="Upload profile photo"
      />
    </div>
  )
}
