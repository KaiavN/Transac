
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/auth-context";
import { Loader2, BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface Employee {
  id: string;
  name: string;
}

interface ActivityLogItem {
  action: string;
  employeeId: string;
  timestamp: string;
  cost?: number;
}

export function OrganizationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmployees, setPendingEmployees] = useState<Employee[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);

  const approveEmployee = async (employeeId: string) => {
    if (!user?.organizationId) {
      toast({
        title: "Error",
        description: "Organization ID not found",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/organizations/${user.organizationId}/employees/${employeeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });

      if (!response.ok) {
        throw new Error('Failed to approve employee');
      }

      setPendingEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      toast({
        title: "Success",
        description: "Employee approved successfully"
      });
    } catch (error) {
      console.error('Approve employee error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve employee",
        variant: "destructive"
      });
    }
  };

  const rejectEmployee = async (employeeId: string) => {
    if (!user?.organizationId) {
      toast({
        title: "Error",
        description: "Organization ID not found",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/organizations/${user.organizationId}/employees/${employeeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      });

      if (!response.ok) {
        throw new Error('Failed to reject employee');
      }

      setPendingEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      toast({
        title: "Success",
        description: "Employee rejected successfully"
      });
    } catch (error) {
      console.error('Reject employee error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject employee",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user?.organizationId) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/organizations/${user.organizationId}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch organization data');
        }
        const data = await response.json();
        setPendingEmployees(data.employeeRequests);
        setActivityLog(data.activityLog);
      } catch (error) {
        console.error('Fetch organization data error:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch organization data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizationData();

    // Set up auto-refresh interval
    const refreshInterval = setInterval(fetchOrganizationData, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [user?.organizationId, toast]);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Organization Dashboard</h1>
        <div className="flex items-center space-x-4">
          {isLoading && <Loader2 className="animate-spin" />}
          <Link href="/organization/transactions">
            <Button variant="outline" className="flex items-center">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Transactions
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Employee Requests</h2>
          {pendingEmployees.length === 0 ? (
            <p className="text-muted-foreground">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {pendingEmployees.map((emp) => (
                <div key={emp.id} className="flex justify-between items-center">
                  <span>{emp.name}</span>
                  <div className="space-x-2">
                    <Button size="sm" onClick={() => approveEmployee(emp.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectEmployee(emp.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activityLog.map((log, i) => (
              <div key={i} className="text-sm border-b pb-2">
                <div className="font-medium">{log.action}</div>
                <div className="text-muted-foreground">
                  {log.employeeId} - {new Date(log.timestamp).toLocaleString()}
                </div>
                {log.cost && (
                  <div className="text-green-600">Cost: £{log.cost.toFixed(2)}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
