"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User } from "@/lib/db"

interface AddUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateUser: (user: Omit<User, 'id' | 'createdAt'>) => void
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

export function AddUserModal({ open, onOpenChange, onCreateUser }: AddUserModalProps) {
  const t = useTranslations('users.addUserModal')
  const [name, setName] = useState("")
  const [userType, setUserType] = useState<"resident" | "guest">("resident")
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) return

    setIsSubmitting(true)
    
    try {
      const newUser: Omit<User, 'id' | 'createdAt'> = {
        name: name.trim(),
        type: userType,
        color: selectedColor,
        avatar: name.charAt(0).toUpperCase()
      }

      await onCreateUser(newUser)
      
      // Reset form
      setName("")
      setUserType("resident")
      setSelectedColor(AVATAR_COLORS[0])
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating user:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

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
            <Label htmlFor="name" className="text-base font-medium">
              {t('name')}
            </Label>
            <Input
              id="name"
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
                t('create')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}