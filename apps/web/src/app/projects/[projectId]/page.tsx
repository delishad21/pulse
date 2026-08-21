import { Dashboard } from "@/components/dashboard";
import { ProjectSections } from "@/components/project-sections";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return (
    <Dashboard title="Project" filter={{ type: "project", projectId }} header={<ProjectSections projectId={projectId} />} />
  );
}
