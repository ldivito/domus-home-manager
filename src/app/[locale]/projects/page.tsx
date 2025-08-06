import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Hammer, Plus, DollarSign, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ProjectsPage() {
  const projects = {
    todo: [
      { id: 1, title: "Paint Living Room", description: "Repaint walls in warm beige", estimatedCost: 150, priority: "medium" },
      { id: 2, title: "Install Smart Thermostat", description: "Replace old thermostat with programmable one", estimatedCost: 250, priority: "low" }
    ],
    inProgress: [
      { id: 3, title: "Kitchen Backsplash", description: "Install subway tile backsplash", estimatedCost: 400, priority: "high" }
    ],
    done: [
      { id: 4, title: "Fix Fence Gate", description: "Replace broken hinges and latch", estimatedCost: 75, priority: "high" }
    ]
  }

  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  }

  const statusColors = {
    todo: 'border-gray-300 bg-gray-50',
    inProgress: 'border-blue-300 bg-blue-50',
    done: 'border-green-300 bg-green-50'
  }

  const ProjectCard = ({ project }: { project: { id: number; title: string; description: string; estimatedCost: number; priority: string } }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{project.title}</CardTitle>
          <Badge className={priorityColors[project.priority as keyof typeof priorityColors]}>
            {project.priority.toUpperCase()}
          </Badge>
        </div>
        <CardDescription className="text-base">{project.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <DollarSign className="mr-1 h-4 w-4" />
            ${project.estimatedCost}
          </div>
          <Button size="sm" variant="outline">Edit</Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Home Projects</h1>
            <p className="text-xl text-gray-600">Kanban board for home improvement tasks</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Add Project
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-4 rounded-lg border-2 ${statusColors.todo}`}>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Hammer className="mr-2 h-5 w-5" />
              To Do ({projects.todo.length})
            </h2>
            {projects.todo.map(project => <ProjectCard key={project.id} project={project} />)}
          </div>
          
          <div className={`p-4 rounded-lg border-2 ${statusColors.inProgress}`}>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              In Progress ({projects.inProgress.length})
            </h2>
            {projects.inProgress.map(project => <ProjectCard key={project.id} project={project} />)}
          </div>
          
          <div className={`p-4 rounded-lg border-2 ${statusColors.done}`}>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Hammer className="mr-2 h-5 w-5" />
              Done ({projects.done.length})
            </h2>
            {projects.done.map(project => <ProjectCard key={project.id} project={project} />)}
          </div>
        </div>
        
        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Project Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-600">{projects.todo.length + projects.inProgress.length}</p>
              <p className="text-sm text-gray-500">Active Projects</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{projects.done.length}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                ${[...projects.todo, ...projects.inProgress].reduce((sum, p) => sum + p.estimatedCost, 0)}
              </p>
              <p className="text-sm text-gray-500">Estimated Cost</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}