export default function UserAvatar({ user, size = 44 }) {
  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join("").toUpperCase() || user?.username?.[0]?.toUpperCase() || "U";

  if (user?.avatar) {
    return (
      <img src={user.avatar} alt="avatar" style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.15)",
      }} />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: `${Math.round(size * 0.38)}px`, fontWeight: 700,
      fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
