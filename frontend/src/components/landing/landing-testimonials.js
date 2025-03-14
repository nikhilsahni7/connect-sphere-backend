export function LandingTestimonials() {
  const testimonials = [
    {
      quote:
        'ConnectSphere has completely changed how our friend group plans get-togethers. No more endless text threads!',
      author: 'Sarah K.',
      role: 'Regular User',
    },
    {
      quote:
        'I use this for everything from dinner parties to hiking trips. The polls feature is a game-changer for deciding where to go.',
      author: 'Michael T.',
      role: 'Event Organizer',
    },
    {
      quote:
        "The real-time updates and notifications keep everyone on the same page. It's so much easier than juggling multiple apps.",
      author: 'Jamie L.',
      role: 'Social Coordinator',
    },
  ];

  return (
    <section className="py-20">
      <div className="container">
        <h2 className="text-3xl font-bold text-center mb-12">What Our Users Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card p-6 rounded-lg shadow-sm">
              <p className="italic mb-4">&quot;{testimonial.quote}&quot;</p>
              <div>
                <p className="font-semibold">{testimonial.author}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
