import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Plane } from "lucide-react"
import { loginAction } from "@/app/actions/auth"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plane className="size-5" />
            <CardTitle>TravelDesk</CardTitle>
          </div>
          <CardDescription>Sign in to raise and approve travel requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required defaultValue="employee1@neo.dev" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required defaultValue="password" />
            </div>
            {error ? <p className="text-sm text-destructive">Invalid email or password.</p> : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium">Demo accounts (password: password)</p>
            <p>employee1@neo.dev — employee</p>
            <p>manager1@neo.dev — employee + supervisor</p>
            <p>finance1@neo.dev — finance</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
