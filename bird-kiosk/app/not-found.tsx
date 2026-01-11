import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPinOff } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-background text-foreground">
      <Card className="w-[min(720px,calc(100%-2rem))] border-border bg-card">
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapPinOff className="h-6 w-6" />
          </div>

          <div className="text-xl font-semibold">Page not found</div>

          <div className="text-sm text-muted-foreground">
            The address you followed doesn’t exist.
          </div>

          <Button onClick={() => (window.location.href = "/")}>Go home</Button>
        </CardContent>
      </Card>
    </main>
  );
}
