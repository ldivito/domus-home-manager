import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Plus, Clock, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function RemindersPage() {
  const reminders = [
    { id: 1, title: "Take out trash", description: "Garbage pickup is tomorrow morning", reminderTime: "2024-01-15T07:00:00", isCompleted: false, type: "general", priority: "high" },
    { id: 2, title: "Water plants", description: "Weekly plant watering day", reminderTime: "2024-01-15T09:00:00", isCompleted: true, type: "chore", priority: "medium" },
    { id: 3, title: "Doctor appointment", description: "Annual checkup with Dr. Smith", reminderTime: "2024-01-16T14:00:00", isCompleted: false, type: "general", priority: "high" },
    { id: 4, title: "Prep dinner ingredients", description: "Start marinating chicken for tonight", reminderTime: "2024-01-15T15:00:00", isCompleted: false, type: "meal", priority: "medium" },
  ]

  const typeColors = {
    general: 'bg-gray-100 text-gray-800',
    chore: 'bg-blue-100 text-blue-800',
    task: 'bg-green-100 text-green-800',
    meal: 'bg-orange-100 text-orange-800'
  }

  const priorityIcons = {
    high: AlertTriangle,
    medium: Clock,
    low: Bell
  }

  const upcomingReminders = reminders.filter(r => !r.isCompleted && new Date(r.reminderTime) > new Date())
  const completedReminders = reminders.filter(r => r.isCompleted)
  const overdueReminders = reminders.filter(r => !r.isCompleted && new Date(r.reminderTime) <= new Date())

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Reminders</h1>
            <p className="text-xl text-gray-600">Visual and audible notifications for important tasks</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Add Reminder
          </Button>
        </div>
        
        {overdueReminders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-red-600 mb-4 flex items-center">
              <AlertTriangle className="mr-2 h-6 w-6" />
              Overdue ({overdueReminders.length})
            </h2>
            <div className="grid gap-4">
              {overdueReminders.map((reminder) => {
                const PriorityIcon = priorityIcons[reminder.priority as keyof typeof priorityIcons]
                return (
                  <Card key={reminder.id} className="border-red-200 bg-red-50">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl text-red-800 flex items-center">
                          <PriorityIcon className="mr-2 h-5 w-5" />
                          {reminder.title}
                        </CardTitle>
                        <Badge className={typeColors[reminder.type as keyof typeof typeColors]}>
                          {reminder.type}
                        </Badge>
                      </div>
                      <CardDescription className="text-base text-red-700">{reminder.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-red-600">
                          Due: {new Date(reminder.reminderTime).toLocaleString()}
                        </div>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700">
                          Mark Complete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <Clock className="mr-2 h-6 w-6" />
              Upcoming ({upcomingReminders.length})
            </h2>
            <div className="space-y-4">
              {upcomingReminders.map((reminder) => {
                const PriorityIcon = priorityIcons[reminder.priority as keyof typeof priorityIcons]
                return (
                  <Card key={reminder.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl flex items-center">
                          <PriorityIcon className="mr-2 h-5 w-5" />
                          {reminder.title}
                        </CardTitle>
                        <Badge className={typeColors[reminder.type as keyof typeof typeColors]}>
                          {reminder.type}
                        </Badge>
                      </div>
                      <CardDescription className="text-base">{reminder.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          {new Date(reminder.reminderTime).toLocaleString()}
                        </div>
                        <Button size="sm" variant="outline">
                          Mark Complete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              
              {upcomingReminders.length === 0 && (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Bell className="mx-auto h-8 w-8 mb-2" />
                      <p className="text-lg">No upcoming reminders</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <CheckCircle className="mr-2 h-6 w-6" />
              Completed ({completedReminders.length})
            </h2>
            <div className="space-y-4">
              {completedReminders.map((reminder) => (
                <Card key={reminder.id} className="opacity-75 bg-green-50">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl text-green-700 flex items-center">
                        <CheckCircle className="mr-2 h-5 w-5" />
                        {reminder.title}
                      </CardTitle>
                      <Badge className={typeColors[reminder.type as keyof typeof typeColors]}>
                        {reminder.type}
                      </Badge>
                    </div>
                    <CardDescription className="text-base text-green-600">{reminder.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-green-600">
                      Completed: {new Date(reminder.reminderTime).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Reminder Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-red-600">{overdueReminders.length}</p>
              <p className="text-sm text-gray-500">Overdue</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{upcomingReminders.length}</p>
              <p className="text-sm text-gray-500">Upcoming</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{completedReminders.length}</p>
              <p className="text-sm text-gray-500">Completed Today</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {reminders.filter(r => r.priority === 'high' && !r.isCompleted).length}
              </p>
              <p className="text-sm text-gray-500">High Priority</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}