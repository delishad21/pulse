import { Dashboard } from "@/components/dashboard";
export default async function ProjectPage({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;return <Dashboard title="Project" filter={{type:"project",projectId}}/>;}
