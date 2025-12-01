'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  Pet,
  PetType,
  PetFeedingSchedule,
  PetMedication,
  PetVetVisit,
  PetVaccination,
  User
} from '@/lib/db'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PawPrint,
  Dog,
  Cat,
  Bird,
  Fish,
  Rabbit,
  Pencil,
  Calendar,
  Phone,
  MapPin,
  Syringe,
  Pill,
  Utensils,
  Clock,
  Plus,
  AlertTriangle,
  Check,
  Shield
} from 'lucide-react'
import { AddFeedingScheduleDialog } from './AddFeedingScheduleDialog'
import { AddMedicationDialog } from './AddMedicationDialog'
import { AddVetVisitDialog } from './AddVetVisitDialog'
import { AddVaccinationDialog } from './AddVaccinationDialog'

interface PetDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pet: Pet | null
  onEdit: () => void
}

const EMPTY_FEEDING_SCHEDULES: PetFeedingSchedule[] = []
const EMPTY_MEDICATIONS: PetMedication[] = []
const EMPTY_VET_VISITS: PetVetVisit[] = []
const EMPTY_VACCINATIONS: PetVaccination[] = []
const EMPTY_USERS: User[] = []

const PET_TYPE_ICONS: Record<PetType, React.ReactNode> = {
  dog: <Dog className="h-6 w-6" />,
  cat: <Cat className="h-6 w-6" />,
  bird: <Bird className="h-6 w-6" />,
  fish: <Fish className="h-6 w-6" />,
  reptile: <PawPrint className="h-6 w-6" />,
  small_mammal: <Rabbit className="h-6 w-6" />,
  other: <PawPrint className="h-6 w-6" />
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

export function PetDetailDialog({ open, onOpenChange, pet, onEdit }: PetDetailDialogProps) {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  // Dialog states for sub-dialogs
  const [addFeedingOpen, setAddFeedingOpen] = useState(false)
  const [addMedicationOpen, setAddMedicationOpen] = useState(false)
  const [addVetVisitOpen, setAddVetVisitOpen] = useState(false)
  const [addVaccinationOpen, setAddVaccinationOpen] = useState(false)

  // Data queries
  const users = useLiveQuery(() => db.users.toArray()) ?? EMPTY_USERS

  const feedingSchedules = useLiveQuery(
    () => pet?.id ? db.petFeedingSchedules.where('petId').equals(pet.id).toArray() : [],
    [pet?.id]
  ) ?? EMPTY_FEEDING_SCHEDULES

  const medications = useLiveQuery(
    () => pet?.id ? db.petMedications.where('petId').equals(pet.id).toArray() : [],
    [pet?.id]
  ) ?? EMPTY_MEDICATIONS

  const vetVisits = useLiveQuery(
    () => pet?.id ? db.petVetVisits.where('petId').equals(pet.id).toArray() : [],
    [pet?.id]
  ) ?? EMPTY_VET_VISITS

  const vaccinations = useLiveQuery(
    () => pet?.id ? db.petVaccinations.where('petId').equals(pet.id).toArray() : [],
    [pet?.id]
  ) ?? EMPTY_VACCINATIONS

  if (!pet) return null

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

  const formatDate = (date: Date) => new Date(date).toLocaleDateString()
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const isVaccinationDue = (nextDueDate?: Date) => {
    if (!nextDueDate) return false
    const now = new Date()
    const dueDate = new Date(nextDueDate)
    return dueDate <= new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  }

  // Sort data
  const sortedVetVisits = [...vetVisits].sort(
    (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
  )
  const sortedVaccinations = [...vaccinations].sort(
    (a, b) => {
      if (a.nextDueDate && b.nextDueDate) {
        return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
      }
      return new Date(b.dateAdministered).getTime() - new Date(a.dateAdministered).getTime()
    }
  )
  const activeSchedules = feedingSchedules.filter(s => s.isActive)
  const activeMedications = medications.filter(m => m.isActive)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {pet.photo ? (
                    <AvatarImage src={pet.photo} alt={pet.name} />
                  ) : null}
                  <AvatarFallback className={PET_TYPE_COLORS[pet.type]}>
                    {PET_TYPE_ICONS[pet.type]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-xl">{pet.name}</span>
                  <p className="text-sm text-muted-foreground font-normal">
                    {pet.breed || t(`types.${pet.type}`)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                {tCommon('edit')}
              </Button>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">{t('detailTabs.overview')}</TabsTrigger>
                <TabsTrigger value="feeding">
                  {t('detailTabs.feeding')}
                  {activeSchedules.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {activeSchedules.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="health">
                  {t('detailTabs.health')}
                  {activeMedications.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {activeMedications.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="vetVisits">{t('detailTabs.vetVisits')}</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4 space-y-4">
                {/* Basic Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('sections.basicInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('fields.type')}</span>
                      <p className="font-medium flex items-center gap-2">
                        {PET_TYPE_ICONS[pet.type]}
                        {t(`types.${pet.type}`)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('fields.gender')}</span>
                      <p className="font-medium">{t(`gender.${pet.gender}`)}</p>
                    </div>
                    {pet.birthDate && (
                      <div>
                        <span className="text-muted-foreground">{t('fields.age')}</span>
                        <p className="font-medium">{calculateAge(pet.birthDate)}</p>
                      </div>
                    )}
                    {pet.weight && (
                      <div>
                        <span className="text-muted-foreground">{t('fields.weight')}</span>
                        <p className="font-medium">{pet.weight} {pet.weightUnit}</p>
                      </div>
                    )}
                    {pet.microchipId && (
                      <div>
                        <span className="text-muted-foreground">{t('fields.microchipId')}</span>
                        <p className="font-medium font-mono">{pet.microchipId}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">{t('form.isNeutered')}</span>
                      <p className="font-medium">{pet.isNeutered ? tCommon('yes') : tCommon('no')}</p>
                    </div>
                    {pet.primaryCaretakerId && (
                      <div>
                        <span className="text-muted-foreground">{t('fields.caretaker')}</span>
                        <p className="font-medium">{getUserName(pet.primaryCaretakerId)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Health Info */}
                {pet.allergies && pet.allergies.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        {t('sections.allergies')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {pet.allergies.map((allergy, idx) => (
                          <Badge key={idx} variant="destructive">{allergy}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Vet Info */}
                {(pet.veterinarianName || pet.emergencyVetName) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('sections.vetInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pet.veterinarianName && (
                        <div>
                          <p className="font-medium">{pet.veterinarianName}</p>
                          {pet.veterinarianPhone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {pet.veterinarianPhone}
                            </p>
                          )}
                          {pet.veterinarianAddress && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {pet.veterinarianAddress}
                            </p>
                          )}
                        </div>
                      )}
                      {pet.emergencyVetName && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">{t('form.emergencyVet')}</p>
                          <p className="font-medium">{pet.emergencyVetName}</p>
                          {pet.emergencyVetPhone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {pet.emergencyVetPhone}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Insurance Info */}
                {pet.insuranceProvider && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t('sections.insurance')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="font-medium">{pet.insuranceProvider}</p>
                      {pet.insurancePolicyNumber && (
                        <p className="text-muted-foreground">
                          {t('form.policyNumber')}: {pet.insurancePolicyNumber}
                        </p>
                      )}
                      {pet.insuranceExpiration && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {t('fields.expires')}: {formatDate(pet.insuranceExpiration)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {pet.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('form.notes')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{pet.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Feeding Tab */}
              <TabsContent value="feeding" className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{t('sections.feedingSchedules')}</h3>
                  <Button size="sm" onClick={() => setAddFeedingOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('actions.addFeeding')}
                  </Button>
                </div>

                {activeSchedules.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Utensils className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('empty.noFeedingSchedules')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {activeSchedules.map((schedule) => (
                      <Card key={schedule.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{schedule.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {schedule.foodType} - {schedule.amount}
                              </p>
                              {schedule.foodBrand && (
                                <p className="text-xs text-muted-foreground">{schedule.foodBrand}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(schedule.scheduledTime)}
                              </Badge>
                              {schedule.assignedUserId && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {getUserName(schedule.assignedUserId)}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Health Tab */}
              <TabsContent value="health" className="mt-4 space-y-6">
                {/* Medications */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      {t('sections.medications')}
                    </h3>
                    <Button size="sm" onClick={() => setAddMedicationOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('actions.addMedication')}
                    </Button>
                  </div>

                  {activeMedications.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">{t('empty.noMedications')}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {activeMedications.map((med) => (
                        <Card key={med.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{med.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {med.dosage} - {t(`medicationFrequency.${med.frequency}`)}
                                </p>
                                {med.prescribedBy && (
                                  <p className="text-xs text-muted-foreground">
                                    {t('fields.prescribedBy')}: {med.prescribedBy}
                                  </p>
                                )}
                              </div>
                              {med.nextDose && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(med.nextDose)}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vaccinations */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium flex items-center gap-2">
                      <Syringe className="h-4 w-4" />
                      {t('sections.vaccinations')}
                    </h3>
                    <Button size="sm" onClick={() => setAddVaccinationOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('actions.addVaccination')}
                    </Button>
                  </div>

                  {sortedVaccinations.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">{t('empty.noVaccinations')}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {sortedVaccinations.map((vax) => (
                        <Card key={vax.id} className={isVaccinationDue(vax.nextDueDate) ? 'border-yellow-500' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium flex items-center gap-2">
                                  {vax.vaccineName}
                                  {isVaccinationDue(vax.nextDueDate) && (
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {t('fields.administered')}: {formatDate(vax.dateAdministered)}
                                </p>
                                {vax.administeredBy && (
                                  <p className="text-xs text-muted-foreground">{vax.administeredBy}</p>
                                )}
                              </div>
                              {vax.nextDueDate && (
                                <Badge
                                  variant={isVaccinationDue(vax.nextDueDate) ? 'destructive' : 'outline'}
                                  className="flex items-center gap-1"
                                >
                                  <Calendar className="h-3 w-3" />
                                  {t('fields.nextDue')}: {formatDate(vax.nextDueDate)}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Vet Visits Tab */}
              <TabsContent value="vetVisits" className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{t('sections.vetVisitHistory')}</h3>
                  <Button size="sm" onClick={() => setAddVetVisitOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('actions.addVetVisit')}
                  </Button>
                </div>

                {sortedVetVisits.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('empty.noVetVisits')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {sortedVetVisits.map((visit) => (
                      <Card key={visit.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{t(`visitTypes.${visit.visitType}`)}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(visit.visitDate)}
                                </span>
                              </div>
                              <p className="font-medium mt-1">{visit.reason}</p>
                              {visit.diagnosis && (
                                <p className="text-sm text-muted-foreground">
                                  {t('fields.diagnosis')}: {visit.diagnosis}
                                </p>
                              )}
                              {visit.treatment && (
                                <p className="text-sm text-muted-foreground">
                                  {t('fields.treatment')}: {visit.treatment}
                                </p>
                              )}
                              {visit.vetName && (
                                <p className="text-xs text-muted-foreground mt-1">{visit.vetName}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {visit.cost && (
                                <p className="font-medium">
                                  {visit.currency} {visit.cost.toLocaleString()}
                                </p>
                              )}
                              {visit.followUpDate && (
                                <Badge variant="secondary" className="mt-1 flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  {t('fields.followUp')}: {formatDate(visit.followUpDate)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <AddFeedingScheduleDialog
        open={addFeedingOpen}
        onOpenChange={setAddFeedingOpen}
        petId={pet.id!}
      />
      <AddMedicationDialog
        open={addMedicationOpen}
        onOpenChange={setAddMedicationOpen}
        petId={pet.id!}
      />
      <AddVetVisitDialog
        open={addVetVisitOpen}
        onOpenChange={setAddVetVisitOpen}
        petId={pet.id!}
      />
      <AddVaccinationDialog
        open={addVaccinationOpen}
        onOpenChange={setAddVaccinationOpen}
        petId={pet.id!}
      />
    </>
  )
}
