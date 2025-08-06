import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, ShoppingCart, Calendar, List, Hammer, UtensilsCrossed, Bell, Users } from "lucide-react"
import { getTranslations } from 'next-intl/server'

export default async function Home() {
  const t = await getTranslations('home')
  const tCommon = await getTranslations('common')

  const modules = [
    {
      titleKey: "chores.title",
      descriptionKey: "chores.description",
      icon: CheckSquare,
      href: "/chores",
      color: "bg-blue-100 text-blue-700"
    },
    {
      titleKey: "grocery.title",
      descriptionKey: "grocery.description",
      icon: ShoppingCart,
      href: "/grocery",
      color: "bg-green-100 text-green-700"
    },
    {
      titleKey: "planner.title",
      descriptionKey: "planner.description",
      icon: Calendar,
      href: "/planner",
      color: "bg-purple-100 text-purple-700"
    },
    {
      titleKey: "tasks.title",
      descriptionKey: "tasks.description",
      icon: List,
      href: "/tasks",
      color: "bg-yellow-100 text-yellow-700"
    },
    {
      titleKey: "projects.title",
      descriptionKey: "projects.description",
      icon: Hammer,
      href: "/projects",
      color: "bg-red-100 text-red-700"
    },
    {
      titleKey: "meals.title",
      descriptionKey: "meals.description",
      icon: UtensilsCrossed,
      href: "/meals",
      color: "bg-orange-100 text-orange-700"
    },
    {
      titleKey: "reminders.title",
      descriptionKey: "reminders.description",
      icon: Bell,
      href: "/reminders",
      color: "bg-pink-100 text-pink-700"
    },
    {
      titleKey: "users.title",
      descriptionKey: "users.description",
      icon: Users,
      href: "/users",
      color: "bg-indigo-100 text-indigo-700"
    }
  ]

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('welcome')}</h1>
          <p className="text-xl text-gray-600">{t('subtitle')}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules.map((module) => (
            <Card key={module.titleKey} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                  <module.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{t(`modules.${module.titleKey}`)}</CardTitle>
                <CardDescription className="text-base">{t(`modules.${module.descriptionKey}`)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                  {tCommon('comingSoon')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
