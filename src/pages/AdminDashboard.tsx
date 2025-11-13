import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [stats, setStats] = useState({
    byStatus: [] as any[],
    byCategory: [] as any[],
    topUpvoted: [] as any[],
    overTime: [] as any[],
    categoryTrends: [] as any[],
    avgResolutionTime: 0,
  });
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [adminComment, setAdminComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (complaints.length > 0) {
      calculateStats(complaints);
    }
  }, [dateRange]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("complaints_with_stats")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setComplaints(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: any[]) => {
    // Filter data by date range
    const filteredData = data.filter((c) => {
      const createdAt = new Date(c.created_at);
      return createdAt >= startOfDay(dateRange.from) && createdAt <= endOfDay(dateRange.to);
    });

    const statusCounts = filteredData.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryCounts = filteredData.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Complaints over time
    const timeMap = new Map<string, number>();
    filteredData.forEach((c) => {
      const date = format(new Date(c.created_at), "MMM dd");
      timeMap.set(date, (timeMap.get(date) || 0) + 1);
    });

    // Category trends over time
    const categoryTimeMap = new Map<string, Record<string, number>>();
    filteredData.forEach((c) => {
      const date = format(new Date(c.created_at), "MMM dd");
      if (!categoryTimeMap.has(date)) {
        categoryTimeMap.set(date, {});
      }
      const dateData = categoryTimeMap.get(date)!;
      dateData[c.category] = (dateData[c.category] || 0) + 1;
    });

    // Calculate average resolution time
    const resolvedComplaints = filteredData.filter((c) => c.status === "RESOLVED");
    let totalResolutionTime = 0;
    resolvedComplaints.forEach((c) => {
      const created = new Date(c.created_at);
      const updated = new Date(c.updated_at);
      totalResolutionTime += differenceInDays(updated, created);
    });
    const avgResolutionTime = resolvedComplaints.length > 0 
      ? Math.round(totalResolutionTime / resolvedComplaints.length) 
      : 0;

    setStats({
      byStatus: Object.entries(statusCounts).map(([name, value]) => ({
        name: name.replace("_", " "),
        value,
      })),
      byCategory: Object.entries(categoryCounts).map(([name, value]) => ({
        name,
        value,
      })),
      topUpvoted: [...filteredData].sort((a, b) => b.upvote_count - a.upvote_count).slice(0, 10),
      overTime: Array.from(timeMap.entries()).map(([date, count]) => ({
        date,
        count,
      })),
      categoryTrends: Array.from(categoryTimeMap.entries()).map(([date, categories]) => ({
        date,
        ...categories,
      })),
      avgResolutionTime,
    });
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;

    try {
      const updates: any = {};
      if (newStatus) updates.status = newStatus;
      if (newPriority) updates.priority = newPriority;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("complaints")
          .update(updates)
          .eq("id", selectedComplaint.id);

        if (error) throw error;
      }

      if (adminComment.trim()) {
        const { data: profileData } = await supabase.auth.getUser();
        
        const { error: commentError } = await supabase
          .from("comments")
          .insert({
            text: adminComment,
            user_id: profileData.user?.id,
            complaint_id: selectedComplaint.id,
          });

        if (commentError) throw commentError;
      }

      toast({
        title: "Success",
        description: "Feedback updated successfully",
      });

      setDialogOpen(false);
      setAdminComment("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openUpdateDialog = (complaint: any) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setNewPriority(complaint.priority);
    setDialogOpen(true);
  };

  const COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

  const statusIcons = {
    NEW: AlertCircle,
    IN_PROGRESS: Clock,
    RESOLVED: CheckCircle,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Analytics and feedback management</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-4 space-y-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From</label>
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                    initialFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To</label>
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complaints.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgResolutionTime} days</div>
            </CardContent>
          </Card>

          {stats.byStatus.map((stat, idx) => {
            const Icon = statusIcons[stat.name.replace(" ", "_") as keyof typeof statusIcons] || AlertCircle;
            return (
              <Card key={stat.name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid gap-6 mb-8">
          {/* Complaints Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Complaints Over Time</CardTitle>
              <CardDescription>Feedback submission trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.overTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Feedback by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.byStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedback by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.byCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.name}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Category Trends Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Category Trends</CardTitle>
              <CardDescription>Feedback categories over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.categoryTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(stats.categoryTrends[0] || {})
                    .filter((key) => key !== "date")
                    .map((category, idx) => (
                      <Line
                        key={category}
                        type="monotone"
                        dataKey={category}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Upvoted */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top 10 Most Upvoted Feedback</CardTitle>
            <CardDescription>High-demand issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topUpvoted.map((complaint, idx) => (
                <div
                  key={complaint.id}
                  className="flex items-center justify-between p-4 bg-card-hover rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/complaint/${complaint.id}`)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{complaint.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{complaint.category}</Badge>
                        <span className="text-xs text-muted-foreground">{complaint.upvote_count} upvotes</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    openUpdateDialog(complaint);
                  }}>
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Complaints Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Feedback</CardTitle>
            <CardDescription>Manage and update feedback status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {complaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="flex items-center justify-between p-4 bg-card-hover rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/complaint/${complaint.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium">{complaint.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{complaint.category}</Badge>
                      <Badge className="text-xs capitalize">{complaint.status.replace("_", " ")}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{complaint.priority}</Badge>
                      <span className="text-xs text-muted-foreground">{complaint.upvote_count} upvotes</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    openUpdateDialog(complaint);
                  }}>
                    Update
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Update Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Feedback</DialogTitle>
            <DialogDescription>{selectedComplaint?.title}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Comment (Optional)</label>
              <Textarea
                placeholder="Add an official comment..."
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateComplaint}>
              Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
