import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ComplaintCardProps {
  complaint: {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    priority: string;
    created_at: string;
    author_name: string;
    author_avatar_url?: string;
    upvote_count: number;
    author_id: string;
  };
  userUpvoted?: boolean;
  onUpvoteChange?: () => void;
}

const statusColors = {
  NEW: "bg-blue-500",
  IN_PROGRESS: "bg-warning",
  RESOLVED: "bg-success",
};

const priorityColors = {
  LOW: "border-muted",
  MEDIUM: "border-warning",
  HIGH: "border-destructive",
};

export function ComplaintCard({ complaint, userUpvoted = false, onUpvoteChange }: ComplaintCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [localUpvoted, setLocalUpvoted] = useState(userUpvoted);
  const [localUpvoteCount, setLocalUpvoteCount] = useState(complaint.upvote_count);

  const isOwnComplaint = profile?.id === complaint.author_id;

  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isOwnComplaint) {
      toast({
        title: "Cannot upvote",
        description: "You cannot upvote your own feedback",
        variant: "destructive",
      });
      return;
    }

    setIsUpvoting(true);

    try {
      if (localUpvoted) {
        // Remove upvote
        const { error } = await supabase
          .from("upvotes")
          .delete()
          .eq("complaint_id", complaint.id)
          .eq("user_id", profile?.id);

        if (error) throw error;

        setLocalUpvoted(false);
        setLocalUpvoteCount(prev => prev - 1);
        toast({ title: "Upvote removed" });
      } else {
        // Add upvote
        const { error } = await supabase
          .from("upvotes")
          .insert({
            complaint_id: complaint.id,
            user_id: profile?.id,
          });

        if (error) throw error;

        setLocalUpvoted(true);
        setLocalUpvoteCount(prev => prev + 1);
        toast({ title: "Upvoted!" });
      }

      onUpvoteChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpvoting(false);
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${priorityColors[complaint.priority as keyof typeof priorityColors]}`}
      onClick={() => navigate(`/complaint/${complaint.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{complaint.title}</CardTitle>
            <CardDescription className="line-clamp-2">{complaint.description}</CardDescription>
          </div>
          <Badge className={statusColors[complaint.status as keyof typeof statusColors]}>
            {complaint.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline">{complaint.category}</Badge>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={complaint.author_avatar_url || undefined} alt={complaint.author_name} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span>by {complaint.author_name}</span>
            </div>
            <span>{formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={localUpvoted ? "default" : "outline"}
              size="sm"
              onClick={handleUpvote}
              disabled={isUpvoting || isOwnComplaint}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              {localUpvoteCount}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
