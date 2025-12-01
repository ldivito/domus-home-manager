"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"
import { User } from "@/lib/db"

interface EditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onUpdateUser: (userId: string, userData: Partial<User>) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
}

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500"
]

export function EditUserModal({ open, onOpenChange, user, onUpdateUser, onDeleteUser }: EditUserModalProps) {
  const t = useTranslations('users.editUserModal')
  const [name, setName] = useState("")
  const [userType, setUserType] = useState<"resident" | "guest">("resident")
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Populate form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name)
      setUserType(user.type)
      setSelectedColor(user.color || AVATAR_COLORS[0])
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !user?.id) return

    setIsSubmitting(true)

    try {
      await onUpdateUser(user.id, {
        name: name.trim(),
        type: userType,
        color: selectedColor,
        avatar: name.charAt(0).toUpperCase()
      })

      onOpenChange(false)
    } catch (error) {
      console.error('Error updating user:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user?.id) return

    setIsDeleting(true)

    try {
      await onDeleteUser(user.id)
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting user:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card shadow-modern-lg border-2">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-base font-medium">
              {t('name')}
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="h-12 text-base"
              required
            />
          </div>

          {/* User Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('userType')}</Label>
            <Select value={userType} onValueChange={(value: "resident" | "guest") => setUserType(value)}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resident" className="py-3">
                  <div>
                    <div className="font-medium">{t('resident')}</div>
                    <div className="text-sm text-gray-500">{t('residentDescription')}</div>
                  </div>
                </SelectItem>
                <SelectItem value="guest" className="py-3">
                  <div>
                    <div className="font-medium">{t('guest')}</div>
                    <div className="text-sm text-gray-500">{t('guestDescription')}</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Avatar Preview and Color Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('selectColor')}</Label>

            {/* Avatar Preview */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Avatar className={`h-20 w-20 ${selectedColor} ring-4 ring-background shadow-modern`}>
                  <AvatarFallback className="text-white text-2xl font-bold">
                    {name ? name.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                </div>
              </div>
            </div>

            {/* Color Selection */}
            <div className="grid grid-cols-5 gap-4">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-14 w-14 rounded-full border-4 transition-all duration-200 ${color} hover:scale-110 active:scale-95 ${
                    selectedColor === color
                      ? "border-primary scale-110 shadow-modern ring-2 ring-primary/50"
                      : "border-border hover:border-primary/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-14 px-4"
                  disabled={isDeleting || isSubmitting}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('deleteDescription', { name: user.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-destructive-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      t('confirmDelete')
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-14 text-base font-medium hover:bg-muted/80 transition-all duration-200"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 h-14 text-base font-medium shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
