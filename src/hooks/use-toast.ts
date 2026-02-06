// Basic toast hook for development
// TODO: Replace with a proper toast implementation (e.g., sonner, react-hot-toast)

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    const message = description ? `${title}\n${description}` : title
    
    if (variant === 'destructive') {
      // Use console.error for destructive toasts
      console.error(`❌ ${message}`)
      alert(`❌ ${title}${description ? `\n${description}` : ''}`)
    } else {
      // Use console.log for normal toasts
      console.log(`✅ ${message}`)
      alert(`✅ ${title}${description ? `\n${description}` : ''}`)
    }
  }

  return { toast }
}