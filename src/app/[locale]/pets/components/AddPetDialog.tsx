'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, PetType, PetGender } from '@/lib/db'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PawPrint, Camera, Dog, Cat, Bird, Fish, Rabbit } from 'lucide-react'
import { toast } from 'sonner'

interface AddPetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PET_TYPES: PetType[] = ['dog', 'cat', 'bird', 'fish', 'reptile', 'small_mammal', 'other']
const PET_GENDERS: PetGender[] = ['male', 'female', 'unknown']

const PET_TYPE_ICONS: Record<PetType, React.ReactNode> = {
  dog: <Dog className="h-4 w-4" />,
  cat: <Cat className="h-4 w-4" />,
  bird: <Bird className="h-4 w-4" />,
  fish: <Fish className="h-4 w-4" />,
  reptile: <PawPrint className="h-4 w-4" />,
  small_mammal: <Rabbit className="h-4 w-4" />,
  other: <PawPrint className="h-4 w-4" />
}

export function AddPetDialog({ open, onOpenChange }: AddPetDialogProps) {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<PetType>('dog')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState<PetGender>('unknown')
  const [birthDate, setBirthDate] = useState('')
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg')
  const [microchipId, setMicrochipId] = useState('')
  const [isNeutered, setIsNeutered] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [veterinarianName, setVeterinarianName] = useState('')
  const [veterinarianPhone, setVeterinarianPhone] = useState('')
  const [veterinarianAddress, setVeterinarianAddress] = useState('')
  const [emergencyVetName, setEmergencyVetName] = useState('')
  const [emergencyVetPhone, setEmergencyVetPhone] = useState('')
  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('')
  const [insuranceExpiration, setInsuranceExpiration] = useState('')
  const [photo, setPhoto] = useState('')
  const [primaryCaretakerId, setPrimaryCaretakerId] = useState('')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get users for caretaker selection
  const users = useLiveQuery(() => db.users.toArray()) ?? []

  const resetForm = () => {
    setName('')
    setType('dog')
    setBreed('')
    setGender('unknown')
    setBirthDate('')
    setWeight('')
    setWeightUnit('kg')
    setMicrochipId('')
    setIsNeutered(false)
    setAllergies('')
    setVeterinarianName('')
    setVeterinarianPhone('')
    setVeterinarianAddress('')
    setEmergencyVetName('')
    setEmergencyVetPhone('')
    setInsuranceProvider('')
    setInsurancePolicyNumber('')
    setInsuranceExpiration('')
    setPhoto('')
    setPrimaryCaretakerId('')
    setNotes('')
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('messages.photoTooLarge'))
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhoto(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('messages.nameRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const now = new Date()
      await db.pets.add({
        id: `pet_${crypto.randomUUID()}`,
        name: name.trim(),
        type,
        breed: breed.trim() || undefined,
        gender,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        weightUnit,
        microchipId: microchipId.trim() || undefined,
        isNeutered,
        allergies: allergies.trim() ? allergies.split(',').map(a => a.trim()) : undefined,
        veterinarianName: veterinarianName.trim() || undefined,
        veterinarianPhone: veterinarianPhone.trim() || undefined,
        veterinarianAddress: veterinarianAddress.trim() || undefined,
        emergencyVetName: emergencyVetName.trim() || undefined,
        emergencyVetPhone: emergencyVetPhone.trim() || undefined,
        insuranceProvider: insuranceProvider.trim() || undefined,
        insurancePolicyNumber: insurancePolicyNumber.trim() || undefined,
        insuranceExpiration: insuranceExpiration ? new Date(insuranceExpiration) : undefined,
        photo: photo || undefined,
        primaryCaretakerId: primaryCaretakerId && primaryCaretakerId !== 'none' ? primaryCaretakerId : undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      })

      toast.success(t('messages.added'))
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding pet:', error)
      toast.error(t('messages.addError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5" />
            {t('dialogs.add.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.add.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
            <TabsTrigger value="health">{t('tabs.health')}</TabsTrigger>
            <TabsTrigger value="vet">{t('tabs.vet')}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Photo Upload */}
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-24 w-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {photo ? (
                    <AvatarImage src={photo} alt={name} />
                  ) : null}
                  <AvatarFallback className="bg-muted">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {t('form.clickToUpload')}
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('form.name')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('form.namePlaceholder')}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>{t('form.type')} *</Label>
              <Select value={type} onValueChange={(v) => setType(v as PetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PET_TYPES.map((petType) => (
                    <SelectItem key={petType} value={petType}>
                      <span className="flex items-center gap-2">
                        {PET_TYPE_ICONS[petType]}
                        {t(`types.${petType}`)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Breed */}
            <div className="space-y-2">
              <Label htmlFor="breed">{t('form.breed')}</Label>
              <Input
                id="breed"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder={t('form.breedPlaceholder')}
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>{t('form.gender')}</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as PetGender)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PET_GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(`gender.${g}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label htmlFor="birthDate">{t('form.birthDate')}</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            {/* Primary Caretaker */}
            <div className="space-y-2">
              <Label>{t('form.primaryCaretaker')}</Label>
              <Select value={primaryCaretakerId} onValueChange={setPrimaryCaretakerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectCaretaker')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('form.noCaretaker')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id!}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-4 mt-4">
            {/* Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">{t('form.weight')}</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.weightUnit')}</Label>
                <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as 'kg' | 'lb')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">{t('units.kg')}</SelectItem>
                    <SelectItem value="lb">{t('units.lb')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Microchip ID */}
            <div className="space-y-2">
              <Label htmlFor="microchipId">{t('form.microchipId')}</Label>
              <Input
                id="microchipId"
                value={microchipId}
                onChange={(e) => setMicrochipId(e.target.value)}
                placeholder={t('form.microchipIdPlaceholder')}
              />
            </div>

            {/* Neutered/Spayed */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isNeutered">{t('form.isNeutered')}</Label>
              <Switch
                id="isNeutered"
                checked={isNeutered}
                onCheckedChange={setIsNeutered}
              />
            </div>

            {/* Allergies */}
            <div className="space-y-2">
              <Label htmlFor="allergies">{t('form.allergies')}</Label>
              <Textarea
                id="allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder={t('form.allergiesPlaceholder')}
                rows={2}
              />
            </div>

            {/* Insurance */}
            <div className="space-y-4 pt-2 border-t">
              <h4 className="font-medium">{t('form.insurance')}</h4>
              <div className="space-y-2">
                <Label htmlFor="insuranceProvider">{t('form.insuranceProvider')}</Label>
                <Input
                  id="insuranceProvider"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder={t('form.insuranceProviderPlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insurancePolicyNumber">{t('form.policyNumber')}</Label>
                  <Input
                    id="insurancePolicyNumber"
                    value={insurancePolicyNumber}
                    onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insuranceExpiration">{t('form.insuranceExpiration')}</Label>
                  <Input
                    id="insuranceExpiration"
                    type="date"
                    value={insuranceExpiration}
                    onChange={(e) => setInsuranceExpiration(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vet" className="space-y-4 mt-4">
            {/* Primary Vet */}
            <div className="space-y-4">
              <h4 className="font-medium">{t('form.primaryVet')}</h4>
              <div className="space-y-2">
                <Label htmlFor="veterinarianName">{t('form.vetName')}</Label>
                <Input
                  id="veterinarianName"
                  value={veterinarianName}
                  onChange={(e) => setVeterinarianName(e.target.value)}
                  placeholder={t('form.vetNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veterinarianPhone">{t('form.vetPhone')}</Label>
                <Input
                  id="veterinarianPhone"
                  type="tel"
                  value={veterinarianPhone}
                  onChange={(e) => setVeterinarianPhone(e.target.value)}
                  placeholder={t('form.vetPhonePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veterinarianAddress">{t('form.vetAddress')}</Label>
                <Textarea
                  id="veterinarianAddress"
                  value={veterinarianAddress}
                  onChange={(e) => setVeterinarianAddress(e.target.value)}
                  placeholder={t('form.vetAddressPlaceholder')}
                  rows={2}
                />
              </div>
            </div>

            {/* Emergency Vet */}
            <div className="space-y-4 pt-2 border-t">
              <h4 className="font-medium">{t('form.emergencyVet')}</h4>
              <div className="space-y-2">
                <Label htmlFor="emergencyVetName">{t('form.vetName')}</Label>
                <Input
                  id="emergencyVetName"
                  value={emergencyVetName}
                  onChange={(e) => setEmergencyVetName(e.target.value)}
                  placeholder={t('form.emergencyVetPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyVetPhone">{t('form.vetPhone')}</Label>
                <Input
                  id="emergencyVetPhone"
                  type="tel"
                  value={emergencyVetPhone}
                  onChange={(e) => setEmergencyVetPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="notes">{t('form.notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('form.notesPlaceholder')}
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? tCommon('saving') : t('actions.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
