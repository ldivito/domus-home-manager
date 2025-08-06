import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, Plus, Calendar, User } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ChoresPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Chores Manager</h1>
            <p className="text-xl text-gray-600">Assign and track recurring household tasks</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Add Chore
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Kitchen Cleanup</CardTitle>
                <CheckSquare className="h-6 w-6 text-blue-600" />
              </div>
              <CardDescription>Clean counters, dishes, and stovetop</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-2 h-4 w-4" />
                  Daily • Due today
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User className="mr-2 h-4 w-4" />
                  Assigned to Mom
                </div>
                <Button className="w-full h-12 text-base">Mark Complete</Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="opacity-75">
            <CardHeader>
              <CardTitle className="text-xl text-green-600">Vacuum Living Room ✓</CardTitle>
              <CardDescription>Weekly deep clean of main areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-2 h-4 w-4" />
                  Weekly • Completed yesterday
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User className="mr-2 h-4 w-4" />
                  Completed by Dad
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <Plus className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">Add your first chore</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}