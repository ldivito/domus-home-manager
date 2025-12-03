'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, Pet, PetType, User, deleteWithSync, bulkDeleteWithSync } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  PawPrint,
  Filter,
  Dog,
  Cat,
  Bird,
  Fish,
  Rabbit,
  Syringe,
  Pill,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { AddPetDialog } from './components/AddPetDialog'
import { EditPetDialog } from './components/EditPetDialog'
import { PetDetailDialog } from './components/PetDetailDialog'

const EMPTY_PETS: Pet[] = []
const EMPTY_USERS: User[] = []
const EMPTY_VACCINATIONS: { petId: string }[] = []
const EMPTY_MEDICATIONS: { petId: string }[] = []
const EMPTY_VET_VISITS: { petId: string }[] = []

const PET_TYPE_ICONS: Record<PetType, React.ReactNode> = {
  dog: <Dog className="h-5 w-5" />,
  cat: <Cat className="h-5 w-5" />,
  bird: <Bird className="h-5 w-5" />,
  fish: <Fish className="h-5 w-5" />,
  reptile: <PawPrint className="h-5 w-5" />,
  small_mammal: <Rabbit className="h-5 w-5" />,
  other: <PawPrint className="h-5 w-5" />
}

const PET_TYPE_COLORS: Record<PetType, string> = {
  dog: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  cat: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  bird: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  fish: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  reptile: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  small_mammal: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

export default function PetsPage() {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<PetType | 'all'>('all')

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Selected items
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)

  // Data queries
  const pets = useLiveQuery(() => db.pets.orderBy('name').toArray()) ?? EMPTY_PETS
  const users = useLiveQuery(() => db.users.toArray()) ?? EMPTY_USERS

  // Query upcoming needs
  const upcomingVaccinations = useLiveQuery(async () => {
    const now = new Date()
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    return db.petVaccinations
      .where('nextDueDate')
      .between(now, twoWeeksFromNow)
      .toArray()
  }) ?? EMPTY_VACCINATIONS

  const activeMedications = useLiveQuery(async () => {
    return db.petMedications
      .where('isActive')
      .equals(1)
      .toArray()
  }) ?? EMPTY_MEDICATIONS

  const upcomingVetVisits = useLiveQuery(async () => {
    const now = new Date()
    const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return db.petVetVisits
      .where('followUpDate')
      .between(now, monthFromNow)
      .toArray()
  }) ?? EMPTY_VET_VISITS

  // Filter pets
  const filteredPets = useMemo(() => {
    return pets.filter(pet => {
      const matchesSearch = pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pet.breed?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType === 'all' || pet.type === selectedType
      return matchesSearch && matchesType
    })
  }, [pets, searchQuery, selectedType])

  // Calculate stats
  const stats = useMemo(() => {
    const byType = pets.reduce((acc, pet) => {
      acc[pet.type] = (acc[pet.type] || 0) + 1
      return acc
    }, {} as Record<PetType, number>)

    return {
      total: pets.length,
      dogs: byType.dog || 0,
      cats: byType.cat || 0,
      other: pets.length - (byType.dog || 0) - (byType.cat || 0),
      upcomingVaccinations: upcomingVaccinations.length,
      activeMedications: activeMedications.length,
      upcomingVetVisits: upcomingVetVisits.length
    }
  }, [pets, upcomingVaccinations, activeMedications, upcomingVetVisits])

  // Helper functions
  const getUserName = (userId?: string) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user?.name || null
  }

  const calculateAge = (birthDate?: Date) => {
    if (!birthDate) return null
    const now = new Date()
    const birth = new Date(birthDate)
    const years = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    const months = Math.floor(((now.getTime() - birth.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))

    if (years === 0) {
      return t('age.months', { months })
    } else if (months === 0) {
      return t('age.years', { years })
    }
    return t('age.yearsAndMonths', { years, months })
  }

  // Action handlers
  const handleDelete = async () => {
    if (!selectedPet?.id) return
    try {
      // Get IDs of all associated records for sync tracking
      const feedingSchedules = await db.petFeedingSchedules.where('petId').equals(selectedPet.id).toArray()
      const feedingLogs = await db.petFeedingLogs.where('petId').equals(selectedPet.id).toArray()
      const medications = await db.petMedications.where('petId').equals(selectedPet.id).toArray()
      const medicationLogs = await db.petMedicationLogs.where('petId').equals(selectedPet.id).toArray()
      const vetVisits = await db.petVetVisits.where('petId').equals(selectedPet.id).toArray()
      const vaccinations = await db.petVaccinations.where('petId').equals(selectedPet.id).toArray()

      // Delete associated records with sync tracking
      await bulkDeleteWithSync(db.petFeedingSchedules, 'petFeedingSchedules', feedingSchedules.map(r => r.id!))
      await bulkDeleteWithSync(db.petFeedingLogs, 'petFeedingLogs', feedingLogs.map(r => r.id!))
      await bulkDeleteWithSync(db.petMedications, 'petMedications', medications.map(r => r.id!))
      await bulkDeleteWithSync(db.petMedicationLogs, 'petMedicationLogs', medicationLogs.map(r => r.id!))
      await bulkDeleteWithSync(db.petVetVisits, 'petVetVisits', vetVisits.map(r => r.id!))
      await bulkDeleteWithSync(db.petVaccinations, 'petVaccinations', vaccinations.map(r => r.id!))

      // Delete the pet itself
      await deleteWithSync(db.pets, 'pets', selectedPet.id)

      toast.success(t('messages.deleted'))
      setDeleteDialogOpen(false)
      setSelectedPet(null)
    } catch (error) {
      console.error('Error deleting pet:', error)
      toast.error(t('messages.deleteError'))
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <PawPrint className="h-8 w-8 text-primary" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('description')}</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('actions.add')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <PawPrint className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.totalPets')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                  <Syringe className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.upcomingVaccinations}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.upcomingVaccinations')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeMedications}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.activeMedications')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.upcomingVetVisits}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.upcomingVetVisits')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {selectedType === 'all' ? t('filter.allTypes') : t(`types.${selectedType}`)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSelectedType('all')}>
              {t('filter.allTypes')}
            </DropdownMenuItem>
            {Object.keys(PET_TYPE_COLORS).map((type) => (
              <DropdownMenuItem key={type} onClick={() => setSelectedType(type as PetType)}>
                <span className="flex items-center gap-2">
                  {PET_TYPE_ICONS[type as PetType]}
                  {t(`types.${type}`)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pet Cards */}
      {filteredPets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <PawPrint className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground mb-4">{t('empty.description')}</p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('actions.add')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPets.map((pet) => {
            const petVaccinations = upcomingVaccinations.filter(v => v.petId === pet.id)
            const petMedications = activeMedications.filter(m => m.petId === pet.id)
            const hasAlerts = petVaccinations.length > 0 || petMedications.length > 0

            return (
              <Card
                key={pet.id}
                className={`cursor-pointer hover:shadow-lg transition-shadow ${hasAlerts ? 'border-yellow-500' : ''}`}
                onClick={() => {
                  setSelectedPet(pet)
                  setDetailDialogOpen(true)
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14">
                        {pet.photo ? (
                          <AvatarImage src={pet.photo} alt={pet.name} />
                        ) : null}
                        <AvatarFallback className={PET_TYPE_COLORS[pet.type]}>
                          {PET_TYPE_ICONS[pet.type]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {pet.name}
                          {hasAlerts && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </CardTitle>
                        <CardDescription>
                          {pet.breed || t(`types.${pet.type}`)}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPet(pet)
                          setEditDialogOpen(true)
                        }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPet(pet)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {tCommon('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={PET_TYPE_COLORS[pet.type]}>
                      <span className="flex items-center gap-1">
                        {PET_TYPE_ICONS[pet.type]}
                        {t(`types.${pet.type}`)}
                      </span>
                    </Badge>
                    {pet.gender !== 'unknown' && (
                      <Badge variant="outline">
                        {t(`gender.${pet.gender}`)}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {pet.birthDate && (
                      <p>{t('fields.age')}: {calculateAge(pet.birthDate)}</p>
                    )}
                    {pet.weight && (
                      <p>{t('fields.weight')}: {pet.weight} {pet.weightUnit}</p>
                    )}
                    {pet.primaryCaretakerId && (
                      <p>{t('fields.caretaker')}: {getUserName(pet.primaryCaretakerId)}</p>
                    )}
                  </div>
                  {hasAlerts && (
                    <div className="mt-3 pt-3 border-t space-y-1">
                      {petVaccinations.length > 0 && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                          <Syringe className="h-3.5 w-3.5" />
                          {t('alerts.vaccinationDue', { count: petVaccinations.length })}
                        </p>
                      )}
                      {petMedications.length > 0 && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Pill className="h-3.5 w-3.5" />
                          {t('alerts.activeMedications', { count: petMedications.length })}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <AddPetDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditPetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        pet={selectedPet}
      />
      <PetDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        pet={selectedPet}
        onEdit={() => {
          setDetailDialogOpen(false)
          setEditDialogOpen(true)
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.delete.description', { name: selectedPet?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
