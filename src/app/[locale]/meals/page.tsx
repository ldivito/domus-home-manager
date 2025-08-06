import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UtensilsCrossed, Plus, Clock, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function MealsPage() {
  const meals = [
    { id: 1, title: "Spaghetti Bolognese", description: "Classic Italian pasta with meat sauce", date: "2024-01-15", mealType: "dinner", ingredients: ["Ground beef", "Pasta", "Tomatoes", "Onions"] },
    { id: 2, title: "Chicken Caesar Salad", description: "Fresh romaine with grilled chicken", date: "2024-01-15", mealType: "lunch", ingredients: ["Chicken breast", "Romaine lettuce", "Parmesan", "Croutons"] },
    { id: 3, title: "Pancakes", description: "Fluffy breakfast pancakes with syrup", date: "2024-01-16", mealType: "breakfast", ingredients: ["Flour", "Eggs", "Milk", "Maple syrup"] },
    { id: 4, title: "Grilled Salmon", description: "Fresh salmon with vegetables", date: "2024-01-16", mealType: "dinner", ingredients: ["Salmon fillet", "Broccoli", "Rice", "Lemon"] },
  ]

  const mealTypeColors = {
    breakfast: 'bg-yellow-100 text-yellow-800',
    lunch: 'bg-blue-100 text-blue-800',
    dinner: 'bg-purple-100 text-purple-800',
    snack: 'bg-green-100 text-green-800'
  }

  const todayMeals = meals.filter(meal => meal.date === "2024-01-15")
  const tomorrowMeals = meals.filter(meal => meal.date === "2024-01-16")

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Meal Planner</h1>
            <p className="text-xl text-gray-600">Plan meals and connect ingredients to grocery list</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Plan Meal
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <Clock className="mr-2 h-6 w-6" />
              Today&apos;s Meals
            </h2>
            <div className="space-y-4">
              {todayMeals.map((meal) => (
                <Card key={meal.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{meal.title}</CardTitle>
                      <Badge className={mealTypeColors[meal.mealType as keyof typeof mealTypeColors]}>
                        {meal.mealType}
                      </Badge>
                    </div>
                    <CardDescription className="text-base">{meal.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Ingredients:</h4>
                        <div className="flex flex-wrap gap-2">
                          {meal.ingredients.map((ingredient, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                              {ingredient}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Add to Grocery List
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <UtensilsCrossed className="mr-2 h-6 w-6" />
              Tomorrow&apos;s Meals
            </h2>
            <div className="space-y-4">
              {tomorrowMeals.map((meal) => (
                <Card key={meal.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{meal.title}</CardTitle>
                      <Badge className={mealTypeColors[meal.mealType as keyof typeof mealTypeColors]}>
                        {meal.mealType}
                      </Badge>
                    </div>
                    <CardDescription className="text-base">{meal.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Ingredients:</h4>
                        <div className="flex flex-wrap gap-2">
                          {meal.ingredients.map((ingredient, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                              {ingredient}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Add to Grocery List
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
                <CardContent className="flex items-center justify-center h-32 text-gray-500">
                  <div className="text-center">
                    <Plus className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-lg">Plan a meal</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Weekly Meal Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-yellow-600">2</p>
              <p className="text-sm text-gray-500">Breakfasts Planned</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">3</p>
              <p className="text-sm text-gray-500">Lunches Planned</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">4</p>
              <p className="text-sm text-gray-500">Dinners Planned</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">12</p>
              <p className="text-sm text-gray-500">Ingredients Needed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}