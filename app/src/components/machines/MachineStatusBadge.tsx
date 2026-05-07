import { Badge } from "@/components/ui/badge";

export function MachineStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge variant="success">В работе</Badge>;
    case "maintenance":
      return <Badge variant="warning">На ТО</Badge>;
    case "decommissioned":
      return <Badge variant="secondary">Выведена</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
