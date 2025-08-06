import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, ShoppingCart, Calendar, List, Hammer, UtensilsCrossed, Bell, Users, ArrowRight, Sparkles } from "lucide-react"
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from "@/components/ui/button"

export default async function Home() {
  const t = await getTranslations('home')
  const tCommon = await getTranslations('common')

  const modules = [
    {
      titleKey: "chores.title",
      descriptionKey: "chores.description",
      icon: CheckSquare,
      href: "/chores",
      gradient: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    {
      titleKey: "grocery.title",
      descriptionKey: "grocery.description",
      icon: ShoppingCart,
      href: "/grocery",
      gradient: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      textColor: "text-green-600 dark:text-green-400"
    },
    {
      titleKey: "planner.title",
      descriptionKey: "planner.description",
      icon: Calendar,
      href: "/planner",
      gradient: "from-purple-500 to-violet-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      textColor: "text-purple-600 dark:text-purple-400"
    },
    {
      titleKey: "tasks.title",
      descriptionKey: "tasks.description",
      icon: List,
      href: "/tasks",
      gradient: "from-yellow-500 to-orange-500",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
      textColor: "text-yellow-600 dark:text-yellow-400"
    },
    {
      titleKey: "projects.title",
      descriptionKey: "projects.description",
      icon: Hammer,
      href: "/projects",
      gradient: "from-red-500 to-pink-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    {
      titleKey: "meals.title",
      descriptionKey: "meals.description",
      icon: UtensilsCrossed,
      href: "/meals",
      gradient: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    {
      titleKey: "reminders.title",
      descriptionKey: "reminders.description",
      icon: Bell,
      href: "/reminders",
      gradient: "from-pink-500 to-rose-500",
      bgColor: "bg-pink-500/10",
      borderColor: "border-pink-500/20",
      textColor: "text-pink-600 dark:text-pink-400"
    },
    {
      titleKey: "users.title",
      descriptionKey: "users.description",
      icon: Users,
      href: "/users",
      gradient: "from-indigo-500 to-purple-500",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
      textColor: "text-indigo-600 dark:text-indigo-400"
    }
  ]

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Tablet-optimized home management</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('welcome')}
            </h1>
            <p className="text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t('subtitle')}
            </p>
          </div>
        </div>
        
        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <Link key={module.titleKey} href={module.href} className="group">
                <Card className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 hover:scale-[1.02] h-full border-2 group-hover:border-primary/20">
                  <CardHeader className="pb-6">
                    <div className="relative">
                      <div className={`w-16 h-16 ${module.bgColor} border ${module.borderColor} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`h-8 w-8 ${module.textColor}`} />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-primary to-primary/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <ArrowRight className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">
                      {t(`modules.${module.titleKey}`)}
                    </CardTitle>
                    <CardDescription className="text-base text-muted-foreground leading-relaxed">
                      {t(`modules.${module.descriptionKey}`)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {module.href === '/users' ? (
                      <div className={`${module.bgColor} border ${module.borderColor} rounded-xl p-4 text-center`}>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className={`font-semibold ${module.textColor}`}>Fully Functional</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/50 border border-border/50 rounded-xl p-4 text-center">
                        <span className="text-muted-foreground font-medium">{tCommon('comingSoon')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Footer CTA */}
        <div className="text-center space-y-6 py-12">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Ready to get started?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Begin by adding your family members and start organizing your home life effortlessly.
            </p>
          </div>
          <Link href="/users">
            <Button 
              size="lg" 
              className="h-16 px-12 text-xl font-semibold shadow-modern-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <Users className="mr-3 h-6 w-6" />
              Add Family Members
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}