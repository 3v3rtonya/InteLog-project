import { useState, useRef } from 'react'
import { apiUploadImage, apiDeleteImage } from '../services/api'
import { useToast } from './Toast'

const MAX = 3
const MAX_SIZE = 5 * 1024 * 1024

export default function ImageUploader({ logId }) {
  const { showToast } = useToast()
  const [images, setImages] = useState([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const upload = async (file) => {
    if (images.length >= MAX) { showToast(`Maximum ${MAX} images allowed`, 'error'); return }
    if (!['image/jpeg', 'image/jpg'].includes(file.type)) { showToast('Only JPEG images are allowed', 'error'); return }
    if (file.size > MAX_SIZE) { showToast('Image must be ≤ 5MB', 'error'); return }
    try {
      const { data } = await apiUploadImage(logId, file)
      setImages(prev => [...prev, { ...data, preview: URL.createObjectURL(file) }])
      showToast('Image uploaded', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Upload failed', 'error')
    }
  }

  const remove = async (img) => {
    try {
      await apiDeleteImage(logId, img.id)
      setImages(prev => prev.filter(i => i.id !== img.id))
      showToast('Image removed', 'info')
    } catch { showToast('Remove failed', 'error') }
  }

  const handleFiles = (files) => Array.from(files).forEach(upload)

  return (
    <div className="image-uploader">
      {images.length < MAX && (
        <div
          className={'drop-zone' + (dragging ? ' drag-over' : '')}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        >
          📎 Drag & drop JPEG images here, or click to browse
          <br /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{images.length}/{MAX} images • Max 5MB each</span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/jpg" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>
      )}
      {images.length > 0 && (
        <div className="image-previews">
          {images.map(img => (
            <div key={img.id} className="image-preview">
              <img src={img.preview || `/uploads/${img.file_path?.split(/[/\\]/).pop()}`} alt={img.original_filename} />
              <button className="image-preview-remove" onClick={() => remove(img)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}