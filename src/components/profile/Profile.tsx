import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    User,
    Briefcase,
    Award,
    Mail,
    Phone,
    Building,
    DollarSign,
    X,
    Save,
    Edit,
    TrendingUp
} from "lucide-react";

const profileSchema = z.object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    contact: z.string().min(10, "Contact number must be at least 10 digits"),
});

const professionalSchema = z.object({
    department: z.string().min(1, "Department is required"),
    designation: z.string().min(2, "Designation is required"),
    hourly_rate: z.string().min(1, "Hourly rate is required"),
});

type ProfileForm = z.infer<typeof profileSchema>;
type ProfessionalForm = z.infer<typeof professionalSchema>;

interface ProfileProps {
    userId: string;
    userRole: "admin" | "employee";
}

interface ProfileData {
    full_name: string;
    email: string;
    contact: string | null;
    avatar_url: string | null;
}

interface EmployeeProfileData {
    department: string | null;
    designation: string | null;
    hourly_rate: number | null;
    performance_score: number;
    current_workload: number;
    tasks_completed: number;
    bio?: string | null;
    id: string;
}

const Profile = ({ userId, userRole }: ProfileProps) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfileData | null>(null);
    const [skillsList, setSkillsList] = useState<string[]>([]);
    const [currentSkill, setCurrentSkill] = useState("");
    const [activeTasks, setActiveTasks] = useState<number>(0);

    const profileForm = useForm<ProfileForm>({
        resolver: zodResolver(profileSchema),
    });

    const professionalForm = useForm<ProfessionalForm>({
        resolver: zodResolver(professionalSchema),
    });

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);

            // Load basic profile
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (profileError) throw profileError;

            setProfileData(profile);
            profileForm.reset({
                full_name: profile.full_name || "",
                email: profile.email || "",
                contact: profile.contact || "",
            });

            // If employee, load employee profile
            if (userRole === "employee") {
                const { data: empProfile, error: empError } = await supabase
                    .from("employee_profiles")
                    .select("*")
                    .eq("user_id", userId)
                    .single();

                if (empError && empError.code !== "PGRST116") throw empError;

                if (empProfile) {
                    setEmployeeProfile(empProfile);
                    professionalForm.reset({
                        department: empProfile.department || "",
                        designation: empProfile.designation || "",
                        hourly_rate: empProfile.hourly_rate?.toString() || "",
                    });

                    // Load skills
                    const { data: skills, error: skillsError } = await supabase
                        .from("employee_skills")
                        .select("skill")
                        .eq("employee_id", empProfile.id);

                    if (skillsError) throw skillsError;

                    setSkillsList(skills?.map(s => s.skill) || []);

                    // Load active tasks count
                    const { data: tasks, error: tasksError } = await supabase
                        .from("tasks")
                        .select("id")
                        .eq("assigned_to", userId)
                        .in("status", ["ongoing", "accepted"]);

                    if (tasksError) throw tasksError;

                    setActiveTasks(tasks?.length || 0);
                }
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            toast.error("Failed to load profile");
        } finally {
            setLoading(false);
        }
    }, [userId, userRole, profileForm, professionalForm]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleProfileUpdate = async (data: ProfileForm) => {
        try {
            setSaving(true);

            const { error } = await supabase
                .from("profiles")
                .update({
                    full_name: data.full_name,
                    contact: data.contact,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            if (error) throw error;

            toast.success("Profile updated successfully!");
            setEditing(false);
            loadProfile();
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleProfessionalUpdate = async (data: ProfessionalForm) => {
        try {
            setSaving(true);

            if (employeeProfile) {
                const { error } = await supabase
                    .from("employee_profiles")
                    .update({
                        department: data.department,
                        designation: data.designation,
                        hourly_rate: parseFloat(data.hourly_rate),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("user_id", userId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("employee_profiles")
                    .insert({
                        user_id: userId,
                        department: data.department,
                        designation: data.designation,
                        hourly_rate: parseFloat(data.hourly_rate),
                        availability: true,
                        current_workload: 0,
                        performance_score: 0,
                        tasks_completed: 0,
                    });

                if (error) throw error;
            }

            toast.success("Professional information updated!");
            setEditing(false);
            loadProfile();
        } catch (error) {
            console.error("Error updating professional info:", error);
            toast.error("Failed to update professional information");
        } finally {
            setSaving(false);
        }
    };

    const addSkill = async () => {
        if (!currentSkill.trim() || skillsList.includes(currentSkill.trim())) return;
        if (!employeeProfile) {
            toast.error("Employee profile not found");
            return;
        }

        try {
            const { error } = await supabase
                .from("employee_skills")
                .insert({
                    employee_id: employeeProfile.id,
                    skill: currentSkill.trim(),
                });

            if (error) throw error;

            setSkillsList([...skillsList, currentSkill.trim()]);
            setCurrentSkill("");
            toast.success("Skill added!");
        } catch (error) {
            console.error("Error adding skill:", error);
            toast.error("Failed to add skill");
        }
    };

    const removeSkill = async (skillToRemove: string) => {
        if (!employeeProfile) return;

        try {
            const { error } = await supabase
                .from("employee_skills")
                .delete()
                .eq("employee_id", employeeProfile.id)
                .eq("skill", skillToRemove);

            if (error) throw error;

            setSkillsList(skillsList.filter(s => s !== skillToRemove));
            toast.success("Skill removed!");
        } catch (error) {
            console.error("Error removing skill:", error);
            toast.error("Failed to remove skill");
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Profile Settings</h2>
                    <p className="text-muted-foreground">
                        Manage your personal and professional information
                    </p>
                </div>
                <Button
                    variant={editing ? "outline" : "default"}
                    onClick={() => setEditing(!editing)}
                >
                    {editing ? (
                        <>Cancel</>
                    ) : (
                        <>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Profile
                        </>
                    )}
                </Button>
            </div>

            {/* Profile Header Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={profileData?.avatar_url || ""} />
                            <AvatarFallback className="text-2xl">
                                {profileData?.full_name ? getInitials(profileData.full_name) : "??"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl font-bold">{profileData?.full_name}</h3>
                            {employeeProfile && (
                                <p className="text-muted-foreground">
                                    {employeeProfile.designation} • {employeeProfile.department}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                                <Badge variant="outline" className="gap-1">
                                    <Mail className="h-3 w-3" />
                                    {profileData?.email}
                                </Badge>
                                {profileData?.contact && (
                                    <Badge variant="outline" className="gap-1">
                                        <Phone className="h-3 w-3" />
                                        {profileData.contact}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="personal" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="personal">
                        <User className="h-4 w-4 mr-2" />
                        Personal Info
                    </TabsTrigger>
                    {userRole === "employee" && (
                        <>
                            <TabsTrigger value="professional">
                                <Briefcase className="h-4 w-4 mr-2" />
                                Professional
                            </TabsTrigger>
                            <TabsTrigger value="skills">
                                <Award className="h-4 w-4 mr-2" />
                                Skills
                            </TabsTrigger>
                            <TabsTrigger value="stats">
                                <TrendingUp className="h-4 w-4 mr-2" />
                                Statistics
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                {/* Personal Information Tab */}
                <TabsContent value="personal">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>
                                Update your personal details and contact information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <Label htmlFor="full_name">Full Name</Label>
                                        <Input
                                            id="full_name"
                                            disabled={!editing}
                                            {...profileForm.register("full_name")}
                                        />
                                        {profileForm.formState.errors.full_name && (
                                            <p className="text-sm text-destructive mt-1">
                                                {profileForm.formState.errors.full_name.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            disabled
                                            className="bg-muted cursor-not-allowed"
                                            {...profileForm.register("email")}
                                        />
                                        {profileForm.formState.errors.email && (
                                            <p className="text-sm text-destructive mt-1">
                                                {profileForm.formState.errors.email.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="contact">Contact Number</Label>
                                        <Input
                                            id="contact"
                                            disabled={!editing}
                                            {...profileForm.register("contact")}
                                        />
                                        {profileForm.formState.errors.contact && (
                                            <p className="text-sm text-destructive mt-1">
                                                {profileForm.formState.errors.contact.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {editing && (
                                    <div className="flex justify-end">
                                        <Button type="submit" disabled={saving}>
                                            {saving ? "Saving..." : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Save Changes
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Professional Information Tab */}
                {userRole === "employee" && (
                    <TabsContent value="professional">
                        <Card>
                            <CardHeader>
                                <CardTitle>Professional Information</CardTitle>
                                <CardDescription>
                                    Manage your work-related details
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={professionalForm.handleSubmit(handleProfessionalUpdate)} className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <Label htmlFor="department">Department</Label>
                                            <Select
                                                value={professionalForm.watch("department")}
                                                onValueChange={(value) => professionalForm.setValue("department", value)}
                                                disabled={!editing}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Engineering">Engineering</SelectItem>
                                                    <SelectItem value="Design">Design</SelectItem>
                                                    <SelectItem value="Marketing">Marketing</SelectItem>
                                                    <SelectItem value="Sales">Sales</SelectItem>
                                                    <SelectItem value="HR">HR</SelectItem>
                                                    <SelectItem value="Operations">Operations</SelectItem>
                                                    <SelectItem value="Finance">Finance</SelectItem>
                                                    <SelectItem value="Customer Support">Customer Support</SelectItem>
                                                    <SelectItem value="Product">Product</SelectItem>
                                                    <SelectItem value="Data Science">Data Science</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {professionalForm.formState.errors.department && (
                                                <p className="text-sm text-destructive mt-1">
                                                    {professionalForm.formState.errors.department.message}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <Label htmlFor="designation">Designation</Label>
                                            <Input
                                                id="designation"
                                                disabled={!editing}
                                                {...professionalForm.register("designation")}
                                            />
                                            {professionalForm.formState.errors.designation && (
                                                <p className="text-sm text-destructive mt-1">
                                                    {professionalForm.formState.errors.designation.message}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <Label htmlFor="hourly_rate">Hourly Rate (USD)</Label>
                                            <Input
                                                id="hourly_rate"
                                                type="number"
                                                step="0.01"
                                                disabled={!editing}
                                                {...professionalForm.register("hourly_rate")}
                                            />
                                            {professionalForm.formState.errors.hourly_rate && (
                                                <p className="text-sm text-destructive mt-1">
                                                    {professionalForm.formState.errors.hourly_rate.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {editing && (
                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={saving}>
                                                {saving ? "Saving..." : (
                                                    <>
                                                        <Save className="mr-2 h-4 w-4" />
                                                        Save Changes
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Skills Tab */}
                {userRole === "employee" && (
                    <TabsContent value="skills">
                        <Card>
                            <CardHeader>
                                <CardTitle>Skills & Expertise</CardTitle>
                                <CardDescription>
                                    Manage your skills to help with task assignments
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add a skill (e.g., React, TypeScript)"
                                        value={currentSkill}
                                        onChange={(e) => setCurrentSkill(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addSkill();
                                            }
                                        }}
                                    />
                                    <Button type="button" onClick={addSkill} variant="outline">
                                        Add
                                    </Button>
                                </div>

                                {skillsList.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/30">
                                        {skillsList.map((skill, index) => (
                                            <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                                                {skill}
                                                <button
                                                    type="button"
                                                    onClick={() => removeSkill(skill)}
                                                    className="ml-2 hover:text-destructive"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>No skills added yet</p>
                                        <p className="text-sm">Add skills to improve task matching</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Statistics Tab */}
                {userRole === "employee" && employeeProfile && (
                    <TabsContent value="stats">
                        <Card>
                            <CardHeader>
                                <CardTitle>Performance Statistics</CardTitle>
                                <CardDescription>
                                    View your work statistics and performance metrics
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="p-4 border rounded-lg">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <Award className="h-4 w-4" />
                                            <span className="text-sm">Performance Score</span>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {(employeeProfile.performance_score * 100).toFixed(0)}%
                                        </p>
                                    </div>

                                    <div className="p-4 border rounded-lg">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <TrendingUp className="h-4 w-4" />
                                            <span className="text-sm">Tasks Completed</span>
                                        </div>
                                        <p className="text-2xl font-bold">{employeeProfile.tasks_completed}</p>
                                    </div>

                                    <div className="p-4 border rounded-lg">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <Briefcase className="h-4 w-4" />
                                            <span className="text-sm">Current Workload</span>
                                        </div>
                                        <p className="text-2xl font-bold">{activeTasks}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default Profile;
