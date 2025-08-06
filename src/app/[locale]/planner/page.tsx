import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PlannerPage() {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    return date
  })

  const events = [
    { id: 1, title: "Grocery Shopping", time: "10:00 AM", type: "task", day: 0 },
    { id: 2, title: "Lunch: Pasta", time: "12:30 PM", type: "meal", day: 0 },
    { id: 3, title: "Doctor Appointment", time: "2:00 PM", type: "reminder", day: 1 },
    { id: 4, title: "Dinner: Tacos", time: "6:00 PM", type: "meal", day: 2 },
  ]

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Daily Planner</h1>
            <p className="text-xl text-gray-600">Weekly calendar with drag & drop scheduling</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Calendar className="mr-2 h-6 w-6" />
            Add Event
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {days.map((day, index) => {
            const dayEvents = events.filter(event => event.day === index)
            const isToday = day.toDateString() === today.toDateString()
            
            return (
              <Card key={index} className={`min-h-96 ${isToday ? 'ring-2 ring-orange-500' : ''}`}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-center">
                    <div className={`text-lg font-semibold ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-orange-700' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dayEvents.map((event) => {
                      const colorMap = {
                        task: 'bg-blue-100 text-blue-800 border-blue-200',
                        meal: 'bg-orange-100 text-orange-800 border-orange-200',
                        reminder: 'bg-purple-100 text-purple-800 border-purple-200'
                      }
                      
                      return (
                        <div key={event.id} className={`p-3 rounded-lg border-l-4 ${colorMap[event.type as keyof typeof colorMap]}`}>
                          <div className="font-medium text-sm">{event.title}</div>
                          <div className="flex items-center text-xs mt-1">
                            <Clock className="mr-1 h-3 w-3" />
                            {event.time}
                          </div>
                        </div>
                      )
                    })}
                    
                    {dayEvents.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <p>No events scheduled</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}