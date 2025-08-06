import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, User, Settings, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export default function UsersPage() {
  const users = [
    { id: 1, name: "Mom", color: "bg-pink-500", avatar: "M", tasks: 12, completedTasks: 8, chores: 5 },
    { id: 2, name: "Dad", color: "bg-blue-500", avatar: "D", tasks: 8, completedTasks: 6, chores: 4 },
    { id: 3, name: "Sarah", color: "bg-purple-500", avatar: "S", tasks: 6, completedTasks: 4, chores: 3 },
    { id: 4, name: "Tommy", color: "bg-green-500", avatar: "T", tasks: 4, completedTasks: 3, chores: 2 },
  ]

  const recentActivity = [
    { user: "Mom", action: "completed", task: "Grocery shopping", time: "2 hours ago" },
    { user: "Dad", action: "completed", task: "Fix leaky faucet", time: "4 hours ago" },
    { user: "Sarah", action: "started", task: "Clean bedroom", time: "6 hours ago" },
    { user: "Tommy", action: "completed", task: "Take out trash", time: "1 day ago" },
  ]

  const getCompletionRate = (completed: number, total: number) => {
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">User Profiles</h1>
            <p className="text-xl text-gray-600">Manage family members and track their contributions</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Add User
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {users.map((user) => {
            const completionRate = getCompletionRate(user.completedTasks, user.tasks)
            return (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-3">
                    <Avatar className={`h-16 w-16 ${user.color}`}>
                      <AvatarFallback className="text-white text-xl font-bold">
                        {user.avatar}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <CardTitle className="text-2xl">{user.name}</CardTitle>
                  <CardDescription className="text-base">
                    Family Member
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-800">{completionRate}%</p>
                      <p className="text-sm text-gray-500">Completion Rate</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-lg font-semibold text-blue-600">{user.tasks}</p>
                        <p className="text-xs text-gray-500">Active Tasks</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-green-600">{user.chores}</p>
                        <p className="text-xs text-gray-500">Chores</p>
                      </div>
                    </div>
                    
                    {completionRate >= 80 && (
                      <Badge className="w-full justify-center bg-yellow-100 text-yellow-800">
                        <Award className="mr-1 h-3 w-3" />
                        Top Performer
                      </Badge>
                    )}
                    
                    <Button variant="outline" size="sm" className="w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <User className="mr-2 h-6 w-6" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => {
                  const user = users.find(u => u.name === activity.user)
                  return (
                    <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <Avatar className={`h-10 w-10 ${user?.color}`}>
                        <AvatarFallback className="text-white font-bold">
                          {user?.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          <span className="text-gray-900">{activity.user}</span>
                          <span className={`ml-1 ${
                            activity.action === 'completed' ? 'text-green-600' : 'text-blue-600'
                          }`}>
                            {activity.action}
                          </span>
                          <span className="text-gray-700 ml-1">{activity.task}</span>
                        </p>
                        <p className="text-sm text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Award className="mr-2 h-6 w-6" />
                Family Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-800">
                    {users.reduce((sum, user) => sum + user.completedTasks, 0)}
                  </p>
                  <p className="text-lg text-gray-600">Total Tasks Completed</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {users.reduce((sum, user) => sum + user.tasks, 0)}
                    </p>
                    <p className="text-sm text-blue-700">Active Tasks</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {users.reduce((sum, user) => sum + user.chores, 0)}
                    </p>
                    <p className="text-sm text-green-700">Assigned Chores</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700">Top Contributors</h4>
                  {users
                    .sort((a, b) => getCompletionRate(b.completedTasks, b.tasks) - getCompletionRate(a.completedTasks, a.tasks))
                    .slice(0, 3)
                    .map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-gray-500 mr-2">#{index + 1}</span>
                          <Avatar className={`h-6 w-6 ${user.color}`}>
                            <AvatarFallback className="text-white text-xs font-bold">
                              {user.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="ml-2 font-medium">{user.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-600">
                          {getCompletionRate(user.completedTasks, user.tasks)}%
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}