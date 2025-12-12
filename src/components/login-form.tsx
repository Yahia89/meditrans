import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"

// Validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { signIn } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: signInError } = await signIn(data.email, data.password)

      if (signInError) {
        // Handle specific error messages
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please try again.")
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Please confirm your email address before logging in.")
        } else {
          setError(signInError.message)
        }
      }
      // Success - auth context will handle the redirect
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      console.error("Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = () => {
    setShowResetPassword(true)
  }

  if (showResetPassword) {
    return <PasswordResetForm onBack={() => setShowResetPassword(false)} />
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit(onSubmit)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email and password to access your account
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            disabled={isLoading}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {errors.email.message}
            </p>
          )}
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="ml-auto text-sm underline-offset-4 hover:underline text-primary"
              disabled={isLoading}
            >
              Forgot your password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            disabled={isLoading}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {errors.password.message}
            </p>
          )}
        </Field>

        <Field>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Login"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

// Password reset form component
const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

function PasswordResetForm({ onBack }: { onBack: () => void }) {
  const { resetPassword } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: resetError } = await resetPassword(data.email)

      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      console.error("Password reset error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground text-sm text-balance">
            We've sent you a password reset link. Please check your email.
          </p>
        </div>
        <Button type="button" onClick={onBack}>
          Back to login
        </Button>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email address and we'll send you a reset link
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input
            id="reset-email"
            type="email"
            placeholder="m@example.com"
            disabled={isLoading}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {errors.email.message}
            </p>
          )}
        </Field>

        <Field>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isLoading}
          >
            Back to login
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
