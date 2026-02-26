import { motion } from "framer-motion";
import avatarLion from "@/assets/avatar-lion.jpg";
import avatarPuppy from "@/assets/avatar-puppy.jpg";
import avatarPeacock from "@/assets/avatar-peacock.jpg";
import avatarFox from "@/assets/avatar-fox.jpg";
import avatarSquirrel from "@/assets/avatar-squirrel.jpg";
import avatarPanda from "@/assets/avatar-panda.jpg";
import avatarMonkey from "@/assets/avatar-monkey.jpg";
import avatarPenguin from "@/assets/avatar-penguin.jpg";
import avatarDuck from "@/assets/avatar-duck.jpg";
import avatarPolarbear from "@/assets/avatar-polarbear.jpg";

export type AvatarAnimal = "lion" | "puppy" | "peacock" | "dove" | "squirrel" | "panda" | "monkey" | "penguin" | "duck" | "polarbear";

interface AnimatedAvatarProps {
  animal: AvatarAnimal;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
}

const AVATAR_CONFIG: Record<AvatarAnimal, { image: string; label: string }> = {
  lion:     { image: avatarLion, label: "Simba" },
  puppy:    { image: avatarPuppy, label: "Buddy" },
  peacock:  { image: avatarPeacock, label: "Plume" },
  dove:     { image: avatarFox, label: "Foxy" },
  squirrel: { image: avatarSquirrel, label: "Nutkin" },
  panda:    { image: avatarPanda, label: "Bamboo" },
  monkey:   { image: avatarMonkey, label: "Coco" },
  penguin:  { image: avatarPenguin, label: "Waddle" },
  duck:     { image: avatarDuck, label: "Quacky" },
  polarbear:{ image: avatarPolarbear, label: "Frost" },
};

const SIZE_CLASSES = {
  sm: "w-7 h-7",
  md: "w-14 h-14",
  lg: "w-20 h-20",
};

export const AnimatedAvatar = ({ animal, size = "md", selected, onClick }: AnimatedAvatarProps) => {
  const config = AVATAR_CONFIG[animal];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{
        scale: 1.12,
        rotate: [0, -3, 3, -2, 0],
        transition: { duration: 0.5, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.9 }}
      className={`relative flex items-center justify-center cursor-pointer rounded-xl overflow-hidden transition-all duration-300 ${SIZE_CLASSES[size]} ${
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
          : "hover:shadow-md"
      }`}
    >
      {/* Avatar image with breathing animation */}
      <motion.img
        src={config.image}
        alt={config.label}
        animate={{
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: Math.random() * 1.5,
        }}
        className="w-full h-full object-cover"
        draggable={false}
        style={{
          filter: selected ? "drop-shadow(0 0 6px hsl(var(--primary) / 0.3))" : "none",
          transition: "filter 0.4s ease",
        }}
      />

      {/* Selected glow overlay */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          animate={{ opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)",
          }}
        />
      )}
    </motion.button>
  );
};

export const AVATAR_ANIMALS: AvatarAnimal[] = ["lion", "puppy", "peacock", "dove", "squirrel", "panda", "monkey", "penguin", "duck", "polarbear"];

export const getAvatarLabel = (animal: AvatarAnimal) => AVATAR_CONFIG[animal].label;
export const getAvatarEmoji = (animal: AvatarAnimal) => AVATAR_CONFIG[animal].image;
