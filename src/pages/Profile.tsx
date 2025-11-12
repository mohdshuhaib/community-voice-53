import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Upload, User, TrendingUp, ThumbsUp } from "lucide-react";
import { Link } from "react-router-dom";

interface ActivityStats {
  totalComplaints: number;
  totalUpvotes: number;
  resolvedComplaints: number;
}

interface UpvoteHistory {
  id: string;
  complaint_id: string;
  created_at: string;
  complaint_title: string;
  complaint_status: string;
}

export default function Profile() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [stats, setStats] = useState<ActivityStats>({
    totalComplaints: 0,
    totalUpvotes: 0,
    resolvedComplaints: 0,
  });
  const [upvoteHistory, setUpvoteHistory] = useState<UpvoteHistory[]>([]);

  useEffect(() => {
    if (profile) {
      fetchActivityStats();
      fetchUpvoteHistory();
    }
  }, [profile]);

  const fetchActivityStats = async () => {
    if (!profile) return;

    const { data: complaints } = await supabase
      .from("complaints")
      .select("status")
      .eq("author_id", profile.id);

    const { data: upvotes } = await supabase
      .from("upvotes")
      .select("id")
      .eq("user_id", profile.id);

    setStats({
      totalComplaints: complaints?.length || 0,
      totalUpvotes: upvotes?.length || 0,
      resolvedComplaints: complaints?.filter((c) => c.status === "RESOLVED").length || 0,
    });
  };

  const fetchUpvoteHistory = async () => {
    if (!profile) return;

    const { data } = await supabase
      .from("upvotes")
      .select(`
        id,
        complaint_id,
        created_at,
        complaints (
          title,
          status
        )
      `)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setUpvoteHistory(
        data.map((item: any) => ({
          id: item.id,
          complaint_id: item.complaint_id,
          created_at: item.created_at,
          complaint_title: item.complaints?.title || "Unknown",
          complaint_status: item.complaints?.status || "UNKNOWN",
        }))
      );
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile?.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile?.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({
        title: "Success",
        description: "Avatar updated successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({ name })
        .eq("id", profile?.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Name updated successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl} alt={profile?.name} />
                  <AvatarFallback>
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Label htmlFor="avatar-upload">
                    <Button variant="outline" size="sm" disabled={uploading} asChild>
                      <span className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? "Uploading..." : "Upload Avatar"}
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile?.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <Button onClick={handleSaveName} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Activity Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Stats</CardTitle>
              <CardDescription>Your feedback activity overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="font-medium">Total Feedback</span>
                  </div>
                  <span className="text-2xl font-bold">{stats.totalComplaints}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-500/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Resolved</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">{stats.resolvedComplaints}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ThumbsUp className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Upvotes Given</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{stats.totalUpvotes}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upvote History */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Upvotes</CardTitle>
            <CardDescription>Feedback you've upvoted</CardDescription>
          </CardHeader>
          <CardContent>
            {upvoteHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                You haven't upvoted any feedback yet
              </p>
            ) : (
              <div className="space-y-3">
                {upvoteHistory.map((item) => (
                  <Link key={item.id} to={`/complaint/${item.complaint_id}`}>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{item.complaint_title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.complaint_status === "RESOLVED"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : item.complaint_status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.complaint_status.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
