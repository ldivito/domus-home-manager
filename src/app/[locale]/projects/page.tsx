'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Hammer, Plus, DollarSign, User, Edit3, Trash2, CheckCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { db, HomeImprovement } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddProjectDialog } from './components/AddProjectDialog'
import { EditProjectDialog } from './components/EditProjectDialog'

export default function ProjectsPage() {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<HomeImprovement | null>(null)

  const projects = useLiveQuery(
    () => db.homeImprovements.orderBy('createdAt').reverse().toArray(),
    []
  ) || []

  const users = useLiveQuery(
    () => db.users.toArray(),
    []
  ) || []

  const priorityColors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  const statusColors = {
    todo: 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50',
    'in-progress': 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30',
    done: 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/30'
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await db.homeImprovements.delete(projectId)
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleEditProject = (project: HomeImprovement) => {
    setEditingProject(project)
    setEditDialogOpen(true)
  }

  const getUserName = (userId?: string) => {
    if (!userId) return tCommon('notAssigned')
    const user = users.find(u => u.id === userId)
    return user?.name || tCommon('notAssigned')
  }

  // Group projects by status
  const projectsByStatus = {
    todo: projects.filter(p => p.status === 'todo'),
    inProgress: projects.filter(p => p.status === 'in-progress'),
    done: projects.filter(p => p.status === 'done')
  }

  const ProjectCard = ({ project }: { project: HomeImprovement }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{project.title}</CardTitle>
          <Badge className={priorityColors[project.priority as keyof typeof priorityColors]}>
            {t(`priority.${project.priority}`)}
          </Badge>
        </div>
        {project.description && (
          <CardDescription className="text-base">{project.description}</CardDescription>
        )}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <User className="mr-1 h-4 w-4" />
            <span>{getUserName(project.assignedUserId)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <DollarSign className="mr-1 h-4 w-4" />
            {project.estimatedCost ? `$${project.estimatedCost.toFixed(2)}` : 'No cost estimate'}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleEditProject(project)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDeleteProject(project.id!)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('title')}</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-6 w-6" />
            {t('addProject')}
          </Button>
        </div>
        
        {projects.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Plus className="mx-auto h-12 w-12 mb-4" />
                <p className="text-xl mb-2">{t('noProjects')}</p>
                <p className="text-base">{t('addFirstProject')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* To Do Column */}
              <div className={`p-4 rounded-lg border-2 ${statusColors.todo}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <Hammer className="mr-2 h-5 w-5" />
                  {t('status.todo')} ({projectsByStatus.todo.length})
                </h2>
                {projectsByStatus.todo.map(project => <ProjectCard key={project.id} project={project} />)}
              </div>

              {/* In Progress Column */}
              <div className={`p-4 rounded-lg border-2 ${statusColors['in-progress']}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  {t('status.inProgress')} ({projectsByStatus.inProgress.length})
                </h2>
                {projectsByStatus.inProgress.map(project => <ProjectCard key={project.id} project={project} />)}
              </div>

              {/* Done Column */}
              <div className={`p-4 rounded-lg border-2 ${statusColors.done}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {t('status.done')} ({projectsByStatus.done.length})
                </h2>
                {projectsByStatus.done.map(project => <ProjectCard key={project.id} project={project} />)}
              </div>
            </div>
            
            {/* Project Summary */}
            <div className="mt-8 p-6 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Project Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{projectsByStatus.todo.length + projectsByStatus.inProgress.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('summary.activeProjects')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{projectsByStatus.done.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('summary.completed')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${[...projectsByStatus.todo, ...projectsByStatus.inProgress]
                      .reduce((sum, p) => sum + (p.estimatedCost || 0), 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('summary.estimatedCost')}</p>
                </div>
              </div>
            </div>
          </>
        )}
        
        <AddProjectDialog 
          open={addDialogOpen} 
          onOpenChange={setAddDialogOpen}
          users={users}
        />
        
        <EditProjectDialog 
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          project={editingProject}
          users={users}
        />
      </div>
    </div>
  )
}