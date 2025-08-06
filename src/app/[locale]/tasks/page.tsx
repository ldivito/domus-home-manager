import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { List, Plus, Calendar, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function TasksPage() {
  const tasks = [
    { id: 1, title: "Fix leaky faucet", description: "Kitchen sink has been dripping", priority: "high", dueDate: "2024-01-15", completed: false },
    { id: 2, title: "Buy birthday gift", description: "Mom's birthday next week", priority: "medium", dueDate: "2024-01-18", completed: false },
    { id: 3, title: "Schedule dentist appointment", description: "6-month checkup", priority: "low", dueDate: null, completed: false },
    { id: 4, title: "Update insurance", description: "Renew car insurance policy", priority: "high", dueDate: "2024-01-20", completed: true },
  ]

  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Task List</h1>
            <p className="text-xl text-gray-600">General to-do list for one-off things</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Add Task
          </Button>
        </div>
        
        <div className="grid gap-6">
          {tasks.map((task) => (
            <Card key={task.id} className={`transition-all ${task.completed ? 'opacity-75 bg-green-50' : 'hover:shadow-md'}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className={`text-xl flex items-center ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {task.completed ? (
                        <CheckCircle className="mr-3 h-6 w-6 text-green-600" />
                      ) : (
                        <List className="mr-3 h-6 w-6 text-gray-600" />
                      )}
                      {task.title}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">{task.description}</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                      {task.priority.toUpperCase()}
                    </Badge>
                    {task.dueDate && !task.completed && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="mr-1 h-4 w-4" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    {task.priority === 'high' && !task.completed && (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="mr-1 h-4 w-4" />
                        <span className="text-sm font-medium">High Priority</span>
                      </div>
                    )}
                  </div>
                  {!task.completed && (
                    <Button className="h-10 px-6">
                      Mark Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
            <CardContent className="flex items-center justify-center h-32 text-gray-500">
              <div className="text-center">
                <Plus className="mx-auto h-8 w-8 mb-2" />
                <p className="text-lg">Add a new task</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}