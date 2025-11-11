import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ComplaintCard } from "@/components/ComplaintCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MyComplaints() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyComplaints();
  }, [profile]);

  const fetchMyComplaints = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("complaints_with_stats")
        .select("*")
        .eq("author_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error("Error fetching my complaints:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Feedback</h1>
            <p className="text-muted-foreground mt-1">Track your submitted feedback</p>
          </div>
          <Button onClick={() => navigate("/new-complaint")}>
            <Plus className="h-4 w-4 mr-2" />
            New Feedback
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">You haven't submitted any feedback yet</p>
            <Button onClick={() => navigate("/new-complaint")}>
              <Plus className="h-4 w-4 mr-2" />
              Submit Your First Feedback
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {complaints.map((complaint) => (
              <ComplaintCard
                key={complaint.id}
                complaint={complaint}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
