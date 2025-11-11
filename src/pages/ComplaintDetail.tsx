import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, MessageSquare, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ComplaintDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [complaint, setComplaint] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userUpvoted, setUserUpvoted] = useState(false);

  useEffect(() => {
    fetchComplaint();
    fetchComments();
    checkUserUpvote();
  }, [id]);

  const fetchComplaint = async () => {
    try {
      const { data, error } = await supabase
        .from("complaints_with_stats")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setComplaint(data);
    } catch (error) {
      console.error("Error fetching complaint:", error);
      toast({
        title: "Error",
        description: "Failed to load feedback",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(`
          *,
          profiles:user_id (name, role)
        `)
        .eq("complaint_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const checkUserUpvote = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("upvotes")
        .select("id")
        .eq("complaint_id", id)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (error) throw error;
      setUserUpvoted(!!data);
    } catch (error) {
      console.error("Error checking upvote:", error);
    }
  };

  const handleUpvote = async () => {
    if (!profile || complaint?.author_id === profile.id) return;

    try {
      if (userUpvoted) {
        await supabase
          .from("upvotes")
          .delete()
          .eq("complaint_id", id)
          .eq("user_id", profile.id);
        setUserUpvoted(false);
        toast({ title: "Upvote removed" });
      } else {
        await supabase
          .from("upvotes")
          .insert({
            complaint_id: id,
            user_id: profile.id,
          });
        setUserUpvoted(true);
        toast({ title: "Upvoted!" });
      }
      fetchComplaint();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newComment.trim()) return;

    setSubmittingComment(true);

    try {
      const { error } = await supabase
        .from("comments")
        .insert({
          text: newComment,
          user_id: profile.id,
          complaint_id: id,
        });

      if (error) throw error;

      setNewComment("");
      toast({ title: "Comment added" });
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
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

  if (!complaint) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Feedback not found</p>
        </div>
      </div>
    );
  }

  const statusColors = {
    NEW: "bg-blue-500",
    IN_PROGRESS: "bg-warning",
    RESOLVED: "bg-success",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={statusColors[complaint.status as keyof typeof statusColors]}>
                    {complaint.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">{complaint.category}</Badge>
                  <Badge variant="outline" className="capitalize">
                    {complaint.priority} Priority
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{complaint.title}</CardTitle>
                <CardDescription className="mt-2">
                  Submitted by {complaint.author_name} • {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}
                </CardDescription>
              </div>
              
              {complaint.author_id !== profile?.id && (
                <Button
                  variant={userUpvoted ? "default" : "outline"}
                  onClick={handleUpvote}
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  {complaint.upvote_count}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{complaint.description}</p>
          </CardContent>
        </Card>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">
            <MessageSquare className="inline h-6 w-6 mr-2" />
            Comments ({comments.length})
          </h2>

          <form onSubmit={handleSubmitComment} className="mb-6">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="mb-2"
            />
            <Button type="submit" disabled={submittingComment || !newComment.trim()}>
              {submittingComment ? "Posting..." : "Post Comment"}
            </Button>
          </form>

          <div className="space-y-4">
            {comments.map((comment) => (
              <Card key={comment.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{comment.profiles.name}</span>
                      {comment.profiles.role === "ADMIN" && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{comment.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
