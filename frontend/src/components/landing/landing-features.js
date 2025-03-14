export function LandingFeatures() {
  const features = [
    {
      title: 'Real-time Chat',
      description:
        'Chat with event participants in real-time to coordinate details and stay connected.',
    },
    {
      title: 'Interactive Polls',
      description: 'Create polls to decide on event details like time, location, or activities.',
    },
    {
      title: 'RSVP Management',
      description:
        "Easily track who's coming, who's bringing guests, and manage dietary preferences.",
    },
    {
      title: 'Location Sharing',
      description:
        'Share event locations with integrated maps and get directions with a single tap.',
    },
    {
      title: 'Calendar Integration',
      description: 'Add events directly to your calendar with automatic updates if details change.',
    },
    {
      title: 'Real-time Notifications',
      description:
        'Stay updated with instant notifications about RSVPs, messages, and event changes.',
    },
  ];

  return (
    <section className="py-20 bg-muted/50">
      <div className="container">
        <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to Connect</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
