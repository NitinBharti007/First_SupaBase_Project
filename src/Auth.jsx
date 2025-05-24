import { useState } from "react"
import supabase from "./SupaBaseClient"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

export const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { toast } = useToast()

  const validateForm = () => {
    if (!email || !password) {
      setError("Please fill in all fields")
      return false
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address")
      return false
    }
    if (isSignUp && password.length < 6) {
      setError("Password must be at least 6 characters long")
      return false
    }
    return true
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    
    if (!validateForm()) return

    setLoading(true)
    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        toast({
          title: "Success",
          description: "Sign up successful! Please check your email for verification.",
        })
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        toast({
          title: "Success",
          description: "Signed in successfully!",
        })
      }
    } catch (error) {
      setError(error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isSignUp ? "Create an Account" : "Sign In"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={isSignUp ? 6 : undefined}
            />
            <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
              {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError("")
              }}
              className="text-sm cursor-pointer"
              disabled={loading}
            >
              {isSignUp
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Auth;
