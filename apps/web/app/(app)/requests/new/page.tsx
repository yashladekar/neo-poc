import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { NewRequestForm } from "@/components/new-request-form"
import { requireSession } from "@/lib/session"

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession()
  const { error } = await searchParams

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-medium">New travel request</h1>
        <p className="text-sm text-muted-foreground">
          Submitting starts the Flowable approval process and routes it to your supervisor.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not submit</AlertTitle>
          <AlertDescription>Please check the form and try again.</AlertDescription>
        </Alert>
      ) : null}

      <NewRequestForm />
    </div>
  )
}
