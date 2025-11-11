import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ThumbsUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NewComplaint() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [similarComplaints, setSimilarComplaints] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (title.length > 3) {
      searchSimilarComplaints();
    } else {
      setSimilarComplaints([]);
    }
  }, [title]);

  const searchSimilarComplaints = async () => {
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("complaints_with_stats")
        .select("*")
        .ilike("title", `%${title}%`)
        .limit(3);

      if (error) throw error;
      setSimilarComplaints(data || []);
    } catch (error) {
      console.error("Error searching complaints:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("complaints")
        .insert([{
          title,
          description,
          category: category as any,
          author_id: profile.id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your feedback has been submitted!",
      });

      navigate("/my-complaints");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpvoteSimilar = async (complaintId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("upvotes")
        .insert({
          complaint_id: complaintId,
          user_id: profile.id,
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already upvoted",
            description: "You've already upvoted this feedback",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Upvoted!",
          description: "Your vote has been added to this existing feedback",
        });
        navigate(`/complaint/${complaintId}`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Submit New Feedback</h1>
          <p className="text-muted-foreground mt-1">Share your concerns and suggestions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            
            {searching && (
              <p className="text-sm text-muted-foreground">Searching for similar feedback...</p>
            )}
            
            {similarComplaints.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Similar feedback exists:</p>
                  <div className="space-y-2">
                    {similarComplaints.map((complaint) => (
                      <Card key={complaint.id} className="bg-card-hover">
                        <CardHeader className="p-4">
                          <CardTitle className="text-sm">{complaint.title}</CardTitle>
                          <CardDescription className="text-xs line-clamp-1">
                            {complaint.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {complaint.upvote_count} upvotes
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpvoteSimilar(complaint.id)}
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Upvote This
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <p className="text-xs mt-2">Or continue to submit your own feedback below</p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                <SelectItem value="Academics">Academics</SelectItem>
                <SelectItem value="Hostel">Hostel</SelectItem>
                <SelectItem value="Faculty">Faculty</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about your feedback..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={6}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Feedback"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/")}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
