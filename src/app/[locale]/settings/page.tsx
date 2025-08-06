import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Palette, Download, Upload, Trash2, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-xl text-gray-600">Customize your Domus experience</p>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Palette className="mr-2 h-6 w-6" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel of your app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Dark Mode</Label>
                  <p className="text-sm text-gray-500">Switch between light and dark themes</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Sun className="h-4 w-4" />
                  <Switch />
                  <Moon className="h-4 w-4" />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-base font-medium">Theme Color</Label>
                <div className="flex space-x-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-full border-2 border-orange-600 cursor-pointer" />
                  <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-transparent hover:border-blue-600 cursor-pointer" />
                  <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-transparent hover:border-green-600 cursor-pointer" />
                  <div className="w-8 h-8 bg-purple-500 rounded-full border-2 border-transparent hover:border-purple-600 cursor-pointer" />
                  <div className="w-8 h-8 bg-pink-500 rounded-full border-2 border-transparent hover:border-pink-600 cursor-pointer" />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Large Text Mode</Label>
                  <p className="text-sm text-gray-500">Increase text size for better readability</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Settings className="mr-2 h-6 w-6" />
                Notifications
              </CardTitle>
              <CardDescription>Manage when and how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Sound Notifications</Label>
                  <p className="text-sm text-gray-500">Play sound for reminders and alerts</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Visual Notifications</Label>
                  <p className="text-sm text-gray-500">Show popup notifications on screen</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Daily Summary</Label>
                  <p className="text-sm text-gray-500">Show daily task summary at startup</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Download className="mr-2 h-6 w-6" />
                Data Management
              </CardTitle>
              <CardDescription>Export, import, or reset your family data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-14 text-base">
                  <Download className="mr-2 h-5 w-5" />
                  Export Data (JSON)
                </Button>
                <Button variant="outline" className="h-14 text-base">
                  <Upload className="mr-2 h-5 w-5" />
                  Import Data
                </Button>
              </div>
              
              <div className="border-t pt-4">
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">Danger Zone</h4>
                  <p className="text-sm text-red-600 mb-4">
                    This action cannot be undone. It will permanently delete all your family data.
                  </p>
                  <Button variant="destructive" className="h-12 text-base">
                    <Trash2 className="mr-2 h-5 w-5" />
                    Reset All Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">About Domus</CardTitle>
              <CardDescription>Application information and credits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Version</h4>
                  <p className="text-gray-600">1.0.0</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Last Updated</h4>
                  <p className="text-gray-600">January 2024</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Storage</h4>
                  <p className="text-gray-600">Local IndexedDB</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Platform</h4>
                  <p className="text-gray-600">Web Application</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">
                  Domus is designed for tablet-first home management. All data is stored locally for privacy and offline access.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}