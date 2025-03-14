import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingHero() {
  return (
    <section className="py-20 md:py-28 flex items-center justify-center min-h-[70vh]">
      <div className="container flex flex-col items-center text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Plan Events, <span className="text-primary">Connect</span> with Friends
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-3xl">
          ConnectSphere makes it easy to plan events, coordinate with friends, and stay connected.
          Create polls, chat in real-time, and manage RSVPs all in one place.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="text-lg px-8 w-full sm:w-auto">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto">
              Login
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Join thousands of people planning events easily
        </p>
      </div>
    </section>
  );
}
