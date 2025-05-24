import { useState, useEffect } from "react"
import supabase from "./SupaBaseClient"
import { Input } from "./components/ui/input"
import { Button } from "./components/ui/button"
import { useToast } from "./components/ui/use-toast"
import { Toaster } from "./components/ui/toaster"

function TaskManager({ session }) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState([])
  const [taskForm, setTaskForm] = useState({ title: "", description: "" })
  const [taskImage, setTaskImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)

  useEffect(() => {
    if (session?.user?.email) {
      fetchTasks()
    }
  }, [session])

  useEffect(() => {
    if (!session?.user?.email) return

    const channel = supabase.channel("tasks-channel")
    
    channel
      .on(
        "postgres_changes",
        { 
          event: "*",
          schema: "public", 
          table: "tasks",
          filter: `email=eq.${session.user.email}`
        },
        (payload) => {
          console.log("Real-time update received:", payload)
          
          if (payload.eventType === "INSERT") {
            console.log("New task received:", payload.new)
            setTasks((prev) => [payload.new, ...prev])
          } 
          else if (payload.eventType === "DELETE") {
            console.log("Task deleted:", payload.old)
            setTasks((prev) => prev.filter((task) => task.id !== payload.old.id))
          }
          else if (payload.eventType === "UPDATE") {
            console.log("Task updated:", payload.new)
            setTasks((prev) =>
              prev.map((task) =>
                task.id === payload.new.id ? payload.new : task
              )
            )
          }
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status)
      })

    return () => {
      channel.unsubscribe()
    }
  }, [session?.user?.email])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("email", session.user.email)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch tasks"
      })
    } finally {
      setLoading(false)
    }
  }

  const uploadImage = async (file) => {
    try {
      const filePath = `${file.name}-${Date.now()}`
      const { error: uploadError } = await supabase.storage
        .from("task-images")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = await supabase.storage
        .from("task-images")
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image upload failed"
      })
      return null
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      const file = e.target.files[0]
      setTaskImage(file)
      // Create immediate preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setTaskForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddOrUpdateTask = async (e) => {
    e.preventDefault()
    if (!session?.user?.email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to add tasks"
      })
      return
    }

    setIsSubmitting(true)
    try {
      let imageUrl = null
      if (taskImage) {
        imageUrl = await uploadImage(taskImage)
      }

      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        email: session.user.email,
        user_id: session.user.id
      }

      if (imageUrl) {
        taskData.image_url = imageUrl
      } else if (isEditing && !taskImage) {
        taskData.image_url = existingImageUrl
      }

      if (isEditing && editingId !== null) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingId)
          .eq("email", session.user.email)

        if (error) throw error
        toast({
          title: "Success",
          description: "Task updated successfully"
        })
        setIsEditing(false)
        setEditingId(null)
        setExistingImageUrl(null)
      } else {
        taskData.image_url = imageUrl || ''
        
        const { error } = await supabase
          .from("tasks")
          .insert(taskData)

        if (error) throw error
        toast({
          title: "Success",
          description: "Task added successfully"
        })
      }

      setTaskForm({ title: "", description: "" })
      setTaskImage(null)
      setImagePreview(null)
      setExistingImageUrl(null)
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) {
        fileInput.value = ''
      }
    } catch (error) {
      console.error("Error in handleAddOrUpdateTask:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add/update task"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this task?")) return

    setLoading(true)
    try {
      console.log("Deleting task with ID:", id)
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("email", session.user.email)

      if (error) {
        console.error("Delete error:", error)
        throw error
      }

      console.log("Delete successful")
      toast({
        title: "Success",
        description: "Task deleted successfully"
      })
      
      setTasks(prevTasks => prevTasks.filter(task => task.id !== id))
    } catch (error) {
      console.error("Error in delete operation:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete task"
      })
      fetchTasks()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (task) => {
    setTaskForm({ 
      title: task.title, 
      description: task.description 
    })
    setIsEditing(true)
    setEditingId(task.id)
    setTaskImage(null)
    setExistingImageUrl(task.image_url)
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {isEditing ? "Edit Task" : "Create New Task"}
        </h2>
        <form onSubmit={handleAddOrUpdateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <Input
              type="text"
              name="title"
              placeholder="Enter task title"
              value={taskForm.title}
              onChange={handleInputChange}
              disabled={isSubmitting}
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Input
              type="text"
              name="description"
              placeholder="Enter task description"
              value={taskForm.description}
              onChange={handleInputChange}
              disabled={isSubmitting}
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEditing ? "Update Image (Optional)" : "Add Image (Optional)"}
            </label>
            <Input 
              type="file" 
              onChange={handleFileChange}
              accept="image/*"
              disabled={isSubmitting}
              className="w-full cursor-pointer"
            />
            {(imagePreview || (isEditing && existingImageUrl)) && (
              <div className="mt-2">
                <p className="text-sm text-gray-500 mb-1">
                  {isEditing ? "Current image:" : "Image preview:"}
                </p>
                <img
                  src={imagePreview || existingImageUrl}
                  alt="Preview"
                  className="h-32 w-32 object-cover rounded-lg shadow-sm"
                />
                {isEditing && !imagePreview && (
                  <p className="text-sm text-gray-500 mt-1">
                    Select a new image to replace the current one
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              type="submit" 
              className="flex-1 cursor-pointer" 
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Processing..."
                : isEditing
                ? "Update Task"
                : "Add Task"}
            </Button>
            {isEditing && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false)
                  setEditingId(null)
                  setTaskForm({ title: "", description: "" })
                  setTaskImage(null)
                  setImagePreview(null)
                  setExistingImageUrl(null)
                }}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Tasks</h3>
        {loading && tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No tasks yet. Create your first task above!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-gray-800">{task.title}</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(task)}
                      disabled={loading}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(task.id)}
                      disabled={loading}
                      className="cursor-pointer hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600 mb-3">{task.description}</p>
                <div className="mt-2">
                  {task.image_url ? (
                    <img
                      src={task.image_url}
                      alt="Task"
                      className="w-full h-[200px] object-contain rounded-lg bg-gray-50"
                    />
                  ) : (
                    <div className="w-full h-[200px] rounded-lg bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-medium">No Image Available</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-sm text-gray-500">
                  Created: {new Date(task.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Toaster />
    </div>
  )
}

export default TaskManager
