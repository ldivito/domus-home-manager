import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Plus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export default function GroceryPage() {
  const groceryItems = [
    { id: 1, name: "Milk", category: "Dairy", completed: false },
    { id: 2, name: "Bread", category: "Bakery", completed: false },
    { id: 3, name: "Apples", category: "Produce", completed: true },
    { id: 4, name: "Chicken", category: "Meat", completed: false },
    { id: 5, name: "Rice", category: "Pantry", completed: false },
  ]

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Grocery List</h1>
            <p className="text-xl text-gray-600">Shared shopping list for the family</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-6 w-6" />
            Add Item
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <ShoppingCart className="mr-3 h-8 w-8" />
              Shopping List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groceryItems.map((item) => (
                <div key={item.id} className={`flex items-center p-4 border rounded-lg transition-all ${
                  item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}>
                  <Checkbox 
                    id={`item-${item.id}`}
                    checked={item.completed}
                    className="h-6 w-6 mr-4"
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={`item-${item.id}`}
                      className={`text-lg cursor-pointer ${
                        item.completed ? 'line-through text-gray-500' : 'text-gray-900'
                      }`}
                    >
                      {item.name}
                    </label>
                    <p className="text-sm text-gray-500">{item.category}</p>
                  </div>
                  {item.completed && (
                    <Check className="h-6 w-6 text-green-600" />
                  )}
                </div>
              ))}
              
              <div className="pt-4 border-t border-gray-200">
                <p className="text-lg text-gray-600">
                  {groceryItems.filter(item => item.completed).length} of {groceryItems.length} items completed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}