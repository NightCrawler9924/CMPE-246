const CONTRIBUTORS = [
  { name: "Deepansh Sabharwal", title: "Systems Lead", email: "deepanshsabh.60@gmail.com" },
  { name: "Dhruv Nikalwala", title: "Safety Lead", email: "dhruv27nickel@gmail.com" },
  { name: "Emilie Labonte", title: "Backend Lead", email: "emilie.g.labonte@gmail.com" },
  { name: "Jaiman Mistry", title: "Hardware Lead", email: "jaimanmistry26@gmail.com" },
  { name: "Hasan Mohammad", title: "Hardware Lead", email: "hasanbm.stu@gmail.com" },
  { name: "Monica Nguyen", title: "Frontend Lead", email: "nguyenle.nhatthuyen@gmail.com" },
];

export function ContributorsFooter() {
  return (
    <footer className="contributors-footer" id="contributors">
      <div className="contributors-head">
        <h3>Contributors</h3>
        <a href="#contributors-list">View Team Roster</a>
      </div>
      <div className="contributors-list" id="contributors-list">
        {CONTRIBUTORS.map((person) => (
          <article key={person.email}>
            <strong>{person.name}</strong>
            <span>{person.title}</span>
            <a href={`mailto:${person.email}`}>{person.email}</a>
          </article>
        ))}
      </div>
    </footer>
  );
}
