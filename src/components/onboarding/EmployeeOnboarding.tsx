import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
    ChevronRight,
    ChevronLeft,
    User,
    Briefcase,
    Award,
    FileText,
    CheckCircle2,
    X
} from "lucide-react";

const personalInfoSchema = z.object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    contact: z.string().min(10, "Contact number must be at least 10 digits"),
});

const professionalInfoSchema = z.object({
    department: z.string().min(1, "Department is required"),
    designation: z.string().min(2, "Designation is required"),
    hourly_rate: z.string().min(1, "Hourly rate is required"),
});

const skillsInfoSchema = z.object({
    skills: z.string().min(1, "At least one skill is required"),
    bio: z.string().optional(),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;
type ProfessionalInfoForm = z.infer<typeof professionalInfoSchema>;
type SkillsInfoForm = z.infer<typeof skillsInfoSchema>;

interface EmployeeOnboardingProps {
    userId: string;
    onComplete: () => void;
}

const EmployeeOnboarding = ({ userId, onComplete }: EmployeeOnboardingProps) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [skillsList, setSkillsList] = useState<string[]>([]);
    const [currentSkill, setCurrentSkill] = useState("");

    const personalForm = useForm<PersonalInfoForm>({
        resolver: zodResolver(personalInfoSchema),
        defaultValues: {
            full_name: "",
            email: "",
            contact: "",
        },
    });

    const professionalForm = useForm<ProfessionalInfoForm>({
        resolver: zodResolver(professionalInfoSchema),
        defaultValues: {
            department: "",
            designation: "",
            hourly_rate: "",
        },
    });

    const skillsForm = useForm<SkillsInfoForm>({
        resolver: zodResolver(skillsInfoSchema),
        defaultValues: {
            skills: "",
            bio: "",
        },
    });

    // Load existing user data from profiles
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("full_name, email")
                    .eq("id", userId)
                    .single();

                if (error) throw error;

                if (profile) {
                    // Pre-fill name and email from signup data
                    if (profile.full_name) {
                        personalForm.setValue("full_name", profile.full_name);
                    }
                    if (profile.email) {
                        personalForm.setValue("email", profile.email);
                    }
                }
            } catch (error) {
                console.error("Error loading user data:", error);
            }
        };

        loadUserData();
    }, [userId, personalForm]);

    const addSkill = () => {
        if (currentSkill.trim() && !skillsList.includes(currentSkill.trim())) {
            const newSkills = [...skillsList, currentSkill.trim()];
            setSkillsList(newSkills);
            skillsForm.setValue("skills", newSkills.join(", "));
            setCurrentSkill("");
        }
    };

    const removeSkill = (skillToRemove: string) => {
        const newSkills = skillsList.filter(s => s !== skillToRemove);
        setSkillsList(newSkills);
        skillsForm.setValue("skills", newSkills.join(", "));
    };

    const handlePersonalInfoSubmit = async (data: PersonalInfoForm) => {
        try {
            setLoading(true);

            // Update profile (email is not updated as it comes from auth signup)
            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    full_name: data.full_name,
                    contact: data.contact,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

            if (profileError) throw profileError;

            toast.success("Personal information saved!");
            setCurrentStep(2);
        } catch (error) {
            console.error("Error saving personal info:", error);
            toast.error("Failed to save personal information");
        } finally {
            setLoading(false);
        }
    };

    const handleProfessionalInfoSubmit = async (data: ProfessionalInfoForm) => {
        try {
            setLoading(true);

            // Check if employee profile exists
            const { data: existingProfile, error: checkError } = await supabase
                .from("employee_profiles")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (checkError && checkError.code !== "PGRST116") {
                throw checkError;
            }

            if (existingProfile) {
                // Update existing profile
                const { error: updateError } = await supabase
                    .from("employee_profiles")
                    .update({
                        department: data.department,
                        designation: data.designation,
                        hourly_rate: parseFloat(data.hourly_rate),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("user_id", userId);

                if (updateError) throw updateError;
            } else {
                // Create new profile
                const { error: insertError } = await supabase
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

                if (insertError) throw insertError;
            }

            toast.success("Professional information saved!");
            setCurrentStep(3);
        } catch (error) {
            console.error("Error saving professional info:", error);
            toast.error("Failed to save professional information");
        } finally {
            setLoading(false);
        }
    };

    const handleSkillsInfoSubmit = async (data: SkillsInfoForm) => {
        try {
            setLoading(true);

            // Get employee profile ID
            const { data: empProfile, error: empError } = await supabase
                .from("employee_profiles")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (empError) throw empError;

            // Delete existing skills
            await supabase
                .from("employee_skills")
                .delete()
                .eq("employee_id", empProfile.id);

            // Insert new skills
            if (skillsList.length > 0) {
                const skillsToInsert = skillsList.map(skill => ({
                    employee_id: empProfile.id,
                    skill: skill,
                }));

                const { error: skillsError } = await supabase
                    .from("employee_skills")
                    .insert(skillsToInsert);

                if (skillsError) throw skillsError;
            }

            // Update employee profile with bio if provided
            if (data.bio && empProfile) {
                const { error: bioError } = await supabase
                    .from("employee_profiles")
                    .update({
                        bio: data.bio,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("user_id", userId);

                if (bioError) throw bioError;
            }

            toast.success("✅ Onboarding completed successfully!");
            onComplete();
        } catch (error) {
            console.error("Error saving skills info:", error);
            toast.error("Failed to save skills information");
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { number: 1, title: "Personal Info", icon: User },
        { number: 2, title: "Professional", icon: Briefcase },
        { number: 3, title: "Skills & Bio", icon: Award },
    ];

    const progress = (currentStep / steps.length) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl">
                <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <CardTitle className="text-2xl">Welcome to ChatFlow Agent! 🎉</CardTitle>
                            <CardDescription>Let's set up your employee profile</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-lg px-4 py-2">
                            Step {currentStep} of {steps.length}
                        </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between">
                            {steps.map((step) => (
                                <div
                                    key={step.number}
                                    className={`flex items-center gap-2 ${currentStep >= step.number ? "text-primary" : "text-muted-foreground"
                                        }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= step.number
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-muted-foreground"
                                            }`}
                                    >
                                        {currentStep > step.number ? (
                                            <CheckCircle2 className="h-5 w-5" />
                                        ) : (
                                            <step.icon className="h-4 w-4" />
                                        )}
                                    </div>
                                    <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {/* Step 1: Personal Information */}
                    {currentStep === 1 && (
                        <form onSubmit={personalForm.handleSubmit(handlePersonalInfoSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-lg font-semibold">
                                    <User className="h-5 w-5" />
                                    Personal Information
                                </div>

                                <div className="grid gap-4">
                                    <div>
                                        <Label htmlFor="full_name">Full Name *</Label>
                                        <Input
                                            id="full_name"
                                            placeholder="John Doe"
                                            {...personalForm.register("full_name")}
                                        />
                                        {personalForm.formState.errors.full_name && (
                                            <p className="text-sm text-destructive mt-1">
                                                {personalForm.formState.errors.full_name.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="email">Email Address *</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="john@example.com"
                                            disabled
                                            className="bg-muted cursor-not-allowed"
                                            {...personalForm.register("email")}
                                        />
                                        {personalForm.formState.errors.email && (
                                            <p className="text-sm text-destructive mt-1">
                                                {personalForm.formState.errors.email.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="contact">Contact Number *</Label>
                                        <Input
                                            id="contact"
                                            placeholder="+1 234 567 8900"
                                            {...personalForm.register("contact")}
                                        />
                                        {personalForm.formState.errors.contact && (
                                            <p className="text-sm text-destructive mt-1">
                                                {personalForm.formState.errors.contact.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Saving..." : "Continue"}
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Step 2: Professional Information */}
                    {currentStep === 2 && (
                        <form onSubmit={professionalForm.handleSubmit(handleProfessionalInfoSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-lg font-semibold">
                                    <Briefcase className="h-5 w-5" />
                                    Professional Information
                                </div>

                                <div className="grid gap-4">
                                    <div>
                                        <Label htmlFor="department">Department *</Label>
                                        <Select
                                            value={professionalForm.watch("department")}
                                            onValueChange={(value) => professionalForm.setValue("department", value)}
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
                                        <Label htmlFor="designation">Designation/Job Title *</Label>
                                        <Input
                                            id="designation"
                                            placeholder="e.g., Senior Software Engineer"
                                            {...professionalForm.register("designation")}
                                        />
                                        {professionalForm.formState.errors.designation && (
                                            <p className="text-sm text-destructive mt-1">
                                                {professionalForm.formState.errors.designation.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="hourly_rate">Hourly Rate (USD) *</Label>
                                        <Input
                                            id="hourly_rate"
                                            type="number"
                                            step="0.01"
                                            placeholder="50.00"
                                            {...professionalForm.register("hourly_rate")}
                                        />
                                        {professionalForm.formState.errors.hourly_rate && (
                                            <p className="text-sm text-destructive mt-1">
                                                {professionalForm.formState.errors.hourly_rate.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Saving..." : "Continue"}
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: Skills & Bio */}
                    {currentStep === 3 && (
                        <form onSubmit={skillsForm.handleSubmit(handleSkillsInfoSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-lg font-semibold">
                                    <Award className="h-5 w-5" />
                                    Skills & Bio
                                </div>

                                <div className="grid gap-4">
                                    <div>
                                        <Label htmlFor="skills">Add Your Skills *</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="skills"
                                                placeholder="e.g., React, TypeScript, Node.js"
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
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Press Enter or click Add to add each skill
                                        </p>
                                        {skillsForm.formState.errors.skills && (
                                            <p className="text-sm text-destructive mt-1">
                                                {skillsForm.formState.errors.skills.message}
                                            </p>
                                        )}
                                    </div>

                                    {skillsList.length > 0 && (
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
                                    )}

                                    <div>
                                        <Label htmlFor="bio">Professional Bio (Optional)</Label>
                                        <Textarea
                                            id="bio"
                                            placeholder="Tell us about yourself, your experience, and what you're passionate about..."
                                            rows={4}
                                            {...skillsForm.register("bio")}
                                        />
                                        <p className="text-sm text-muted-foreground mt-1">
                                            This will be visible to admins and team members
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button type="submit" disabled={loading || skillsList.length === 0}>
                                    {loading ? "Completing..." : "Complete Onboarding"}
                                    <CheckCircle2 className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default EmployeeOnboarding;
