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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('title')}</DialogTitle>
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
            <div className="flex justify-center mb-4">
              <Avatar className={`h-16 w-16 ${selectedColor}`}>
                <AvatarFallback className="text-white text-xl font-bold">
                  {name ? name.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* Color Selection */}
            <div className="grid grid-cols-5 gap-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-12 w-12 rounded-full border-4 transition-all ${color} ${
                    selectedColor === color 
                      ? "border-gray-800 scale-110" 
                      : "border-gray-300 hover:border-gray-500"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 text-base"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 h-12 text-base"
            >
              {isSubmitting ? "..." : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}