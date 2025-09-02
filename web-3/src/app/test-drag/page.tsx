"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export default function TestDragPage() {
  const [x, setX] = useState(0);
  
  return (
    <div className="container flex h-screen items-center justify-center">
      <motion.div
        className="h-64 w-64 bg-blue-500 cursor-grab active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: -200, right: 200 }}
        onDrag={(e, info) => {
          setX(info.offset.x);
        }}
        onDragEnd={() => {
          setX(0);
        }}
        animate={{ x }}
      >
        <p className="p-4 text-white">Drag me! X: {Math.round(x)}</p>
      </motion.div>
    </div>
  );
}