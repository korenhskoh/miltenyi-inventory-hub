import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from "recharts";
import { Search, Package, TrendingUp, Truck, Bell, MessageSquare, Settings, ChevronDown, ChevronRight, Plus, Filter, Download, Mail, Phone, CheckCircle, AlertTriangle, Clock, X, Menu, Home, ClipboardList, BarChart3, Eye, Send, RefreshCw, Users, User, Calendar, DollarSign, Archive, AlertCircle, Check, ExternalLink, FileText, Database, Tag, ArrowUpDown, ArrowUp, ArrowDown, Edit3, Trash2, Copy, Printer, ShoppingCart, UserPlus, Shield, Lock, LogOut, QrCode, Wifi, WifiOff, Layers, FolderPlus, ChevronLeft, Bot, Upload, Sparkles, FileUp, MessageCircle, Zap, Brain, PanelRightOpen, PanelRightClose } from "lucide-react";

// ════════════════════════════ DATA ════════════════════════════════════
const PARTS_CATALOG = [{"m": "130-132-330", "d": "CFast 2.0 Card 128GB", "c": "RES-IM-MACSima-Spare Parts", "sg": 1810.0, "dist": 710.0, "tp": 345.03, "rsp": 638.01}, {"m": "200-075-552", "d": "Motion Controller CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 5960.0, "dist": 2300.0, "tp": 1117.4, "rsp": 2110.8}, {"m": "130-132-970", "d": "Yearly Maintenance Kit, MACSima", "c": "RES-IM-MACSima-Spare Parts", "sg": 9600.0, "dist": 5850.0, "tp": 2853.51, "rsp": 3399.16}, {"m": "200-075-560", "d": "Ventilation Unit, TCU CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 14120.0, "dist": 8480.0, "tp": 4135.51, "rsp": 4998.38}, {"m": "200-075-646", "d": "Microscope Camera Board II", "c": "CLI-CS-Spare Parts", "sg": 14000.0, "dist": 5170.0, "tp": 2521.72, "rsp": 4956.36}, {"m": "200-075-553", "d": "Focus Servo CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 1650.0, "dist": 610.0, "tp": 296.67, "rsp": 581.06}, {"m": "130-115-131", "d": "Needle Arm Mixing Gasket", "c": "RES-CA-Spare Parts", "sg": 2290.0, "dist": 840.0, "tp": 409.41, "rsp": 810.13}, {"m": "130-097-851", "d": "Dilutor Valve, 6-port distribution, v3", "c": "RES-OT-Spare Parts", "sg": 5590.0, "dist": 2040.0, "tp": 991.45, "rsp": 1976.83}, {"m": "130-130-240", "d": "Spring Return", "c": "RES-IM-MACSima-Spare Parts", "sg": 1800.0, "dist": 650.0, "tp": 313.45, "rsp": 637.57}, {"m": "130-090-685", "d": "4-port distribution valve", "c": "RES-OT-Spare Parts", "sg": 1720.0, "dist": 620.0, "tp": 298.74, "rsp": 607.65}, {"m": "200-075-768", "d": "Door contacts micro switch", "c": "CLI-PP-Spare Parts", "sg": 1130.0, "dist": 410.0, "tp": 196.06, "rsp": 398.8}, {"m": "200-075-672", "d": "Pump controller PCB VIMOT v3", "c": "CLI-PP-Spare Parts", "sg": 2870.0, "dist": 1030.0, "tp": 499.69, "rsp": 1016.39}, {"m": "130-115-124", "d": "Sheath Particle Filter, small", "c": "RES-CA-Spare Parts", "sg": 1250.0, "dist": 450.0, "tp": 216.19, "rsp": 439.74}, {"m": "130-094-729", "d": "Dilutor Valve, 6-port distribution, v2", "c": "RES-CS-Spare Parts", "sg": 2380.0, "dist": 850.0, "tp": 412.92, "rsp": 839.9}, {"m": "200-075-769", "d": "Excenter drive", "c": "CLI-PP-Spare Parts", "sg": 9300.0, "dist": 3320.0, "tp": 1619.45, "rsp": 3294.06}, {"m": "130-114-813", "d": "Horizontal mirror adjuster", "c": "RES-CA-Spare Parts", "sg": 6350.0, "dist": 2270.0, "tp": 1104.88, "rsp": 2247.38}, {"m": "200-075-554", "d": "Chamber Drive Servo Motor CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 7090.0, "dist": 2530.0, "tp": 1233.97, "rsp": 2509.96}, {"m": "130-090-684", "d": "4-port 4-way valve", "c": "RES-OT-Spare Parts", "sg": 1570.0, "dist": 560.0, "tp": 270.58, "rsp": 555.6}, {"m": "130-122-182", "d": "6-Port Distribution Valve, MQ", "c": "RES-CA-Spare Parts", "sg": 4290.0, "dist": 1520.0, "tp": 740.81, "rsp": 1517.79}, {"m": "130-094-683", "d": "Sheath Particle Filter, PALL Ultipor N66", "c": "RES-OT-Spare Parts", "sg": 1490.0, "dist": 530.0, "tp": 258.17, "rsp": 525.12}, {"m": "130-093-371", "d": "4-port 3-way Valve", "c": "RES-CS-Spare Parts", "sg": 1800.0, "dist": 620.0, "tp": 300.38, "rsp": 634.06}, {"m": "130-097-866", "d": "Pump Syringe, Hamilton, 5ml, PSD4, v3", "c": "RES-OT-Spare Parts", "sg": 1560.0, "dist": 440.0, "tp": 210.64, "rsp": 550.82}, {"m": "130-127-427", "d": "IQ/OQ Fixed WBC, 1x10e7/ml, 7ml", "c": "RES-CA-Spare Parts", "sg": 310.0, "dist": 90.0, "tp": 41.75, "rsp": 108.8}, {"m": "130-127-414", "d": "IQ/OQ Fixed WBC, CD45VB, 1x10e7/ml, 13ml", "c": "RES-CA-Spare Parts", "sg": 1000.0, "dist": 280.0, "tp": 135.79, "rsp": 353.79}, {"m": "130-128-514", "d": "Tyto BioQC cell sample", "c": "RES-CA-Spare Parts", "sg": 430.0, "dist": 120.0, "tp": 56.76, "rsp": 150.84}, {"m": "200-075-775", "d": "Reed switch", "c": "CLI-PP-Spare Parts", "sg": 910.0, "dist": 250.0, "tp": 120.03, "rsp": 318.97}, {"m": "130-118-210", "d": "Peristaltic Pump Head, white", "c": "RES-CA-Spare Parts", "sg": 330.0, "dist": 90.0, "tp": 40.64, "rsp": 116.49}, {"m": "200-075-721", "d": "CMPR Maintenance Kit", "c": "CLI-CS-Spare Parts", "sg": 1240.0, "dist": 320.0, "tp": 152.62, "rsp": 437.42}, {"m": "130-097-867", "d": "Pump Syringe, Hamilton, 0.5ml, PSD4, v3", "c": "RES-OT-Spare Parts", "sg": 1280.0, "dist": 330.0, "tp": 157.53, "rsp": 451.46}, {"m": "200-075-780", "d": "Silicone gasket bottom housing", "c": "CLI-PP-Spare Parts", "sg": 780.0, "dist": 200.0, "tp": 95.48, "rsp": 273.64}, {"m": "130-127-593", "d": "Rear Fan Air Filter, MACSima", "c": "RES-IM-MACSima-Spare Parts", "sg": 1060.0, "dist": 270.0, "tp": 130.83, "rsp": 374.96}, {"m": "130-090-385", "d": "Hydrophobic air filter", "c": "RES-OT-Spare Parts", "sg": 150.0, "dist": 40.0, "tp": 18.02, "rsp": 51.65}, {"m": "130-115-122", "d": "Peristaltic Pump Sample Tube", "c": "RES-CA-Spare Parts", "sg": 470.0, "dist": 120.0, "tp": 57.83, "rsp": 165.74}, {"m": "130-093-365", "d": "Peristaltic Pump Head incl. Tube", "c": "RES-OT-Spare Parts", "sg": 750.0, "dist": 190.0, "tp": 91.7, "rsp": 262.82}, {"m": "130-115-120", "d": "Bio tubing, OD=6,4mm, 250mm", "c": "RES-CA-Spare Parts", "sg": 240.0, "dist": 60.0, "tp": 28.56, "rsp": 81.86}, {"m": "200-075-723", "d": "Hood Light Protection Cover", "c": "CLI-CS-Spare Parts", "sg": 240.0, "dist": 60.0, "tp": 29.19, "rsp": 83.67}, {"m": "130-131-056", "d": "Laser, white, 5.5W, NKT SuperK FIU-15", "c": "RES-IM-UM-Spare Parts", "sg": 286120.0, "dist": 218450.0, "tp": 106560.0, "rsp": 101347.2}, {"m": "130-126-641", "d": "Laser, white, 6W, NKT SuperK EXW-12", "c": "RES-IM-UM-Spare Parts", "sg": 265030.0, "dist": 220750.0, "tp": 107678.88, "rsp": 93877.07}, {"m": "130-127-424", "d": "MACSima 1.5 microscope", "c": "RES-IM-MACSima-Spare Parts", "sg": 222850.0, "dist": 170150.0, "tp": 82995.51, "rsp": 78935.46}, {"m": "130-130-241", "d": "Microscope 1.5.1", "c": "RES-IM-MACSima-Spare Parts", "sg": 199710.0, "dist": 162460.0, "tp": 79247.4, "rsp": 70738.52}, {"m": "135-130-241", "d": "MACSima 1.5 microscope", "c": "RES-IM-MACSima-Spare Parts", "sg": 139800.0, "dist": 113730.0, "tp": 55473.18, "rsp": 49516.97}, {"m": "130-127-710", "d": "Double PC (Storage Rack) Win", "c": "RES-IM-MACSima-Spare Parts", "sg": 127790.0, "dist": 99520.0, "tp": 48543.98, "rsp": 45263.98}, {"m": "130-094-728", "d": "Optical Bench", "c": "RES-OT-Spare Parts", "sg": 123660.0, "dist": 94410.0, "tp": 46053.22, "rsp": 43800.34}, {"m": "130-133-286", "d": "Double PC (Storage Rack) MB Core", "c": "RES-IM-MACSima-Spare Parts", "sg": 103540.0, "dist": 79050.0, "tp": 38560.72, "rsp": 36674.37}, {"m": "200-075-671", "d": "Pump Unit v2 tested", "c": "CLI-PP-Spare Parts", "sg": 91060.0, "dist": 69530.0, "tp": 33912.48, "rsp": 32253.52}, {"m": "135-127-710", "d": "PC-Storage-Rack Refurb MBCore INTERNAL", "c": "RES-IM-MACSima-Spare Parts", "sg": 89450.0, "dist": 69670.0, "tp": 33980.8, "rsp": 31684.78}, {"m": "130-127-589", "d": "Lightbox", "c": "RES-IM-MACSima-Spare Parts", "sg": 74460.0, "dist": 56850.0, "tp": 27730.63, "rsp": 26374.08}, {"m": "135-133-286", "d": "PC-Storage-Rack MBCore", "c": "RES-IM-MACSima-Spare Parts", "sg": 72480.0, "dist": 55340.0, "tp": 26992.5, "rsp": 25672.06}, {"m": "130-127-703", "d": "Constant Pressure Controller CPC", "c": "RES-IM-MACSima-Spare Parts", "sg": 70130.0, "dist": 58900.0, "tp": 28730.61, "rsp": 24841.04}, {"m": "130-130-231", "d": "Needle Arm Unit V2", "c": "RES-IM-Spare Parts", "sg": 64900.0, "dist": 49550.0, "tp": 24169.21, "rsp": 22986.88}, {"m": "130-127-138", "d": "SuperPlan Detection AO", "c": "RES-IM-UM-Spare Parts", "sg": 60780.0, "dist": 43440.0, "tp": 21187.68, "rsp": 21527.54}, {"m": "200-075-770", "d": "Pump Unit", "c": "CLI-PP-Spare Parts", "sg": 57470.0, "dist": 42520.0, "tp": 20741.16, "rsp": 20356.48}, {"m": "130-124-609", "d": "Laser, 561nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 52970.0, "dist": 40440.0, "tp": 19724.48, "rsp": 18759.57}, {"m": "130-097-849", "d": "Laser Coherent, yellow, 100 mW, Fan incl", "c": "RES-OT-Spare Parts", "sg": 51840.0, "dist": 39580.0, "tp": 19304.53, "rsp": 18360.17}, {"m": "130-126-582", "d": "Camera, PCO Edge 5.5 MP", "c": "RES-IM-UM-Spare Parts", "sg": 50370.0, "dist": 38460.0, "tp": 18759.0, "rsp": 17841.33}, {"m": "130-126-583", "d": "Camera, PCO Edge 4.2 MP", "c": "RES-IM-UM-Spare Parts", "sg": 50370.0, "dist": 38460.0, "tp": 18759.0, "rsp": 17841.33}, {"m": "130-124-612", "d": "Laser, 532nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 47140.0, "dist": 35990.0, "tp": 17555.46, "rsp": 16696.67}, {"m": "130-126-586", "d": "Camera, Andor Zyla 5.5 MP", "c": "RES-IM-UM-Spare Parts", "sg": 45530.0, "dist": 55710.0, "tp": 27172.8, "rsp": 16125.0}, {"m": "130-132-519", "d": "Sample & Reagent Chamber", "c": "RES-IM-MACSima-Spare Parts", "sg": 45120.0, "dist": 41770.0, "tp": 20373.12, "rsp": 15979.07}, {"m": "130-124-611", "d": "Laser, 594nm, 60mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 44530.0, "dist": 34000.0, "tp": 16583.92, "rsp": 15772.65}, {"m": "130-124-610", "d": "Laser, 488nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 43680.0, "dist": 33350.0, "tp": 16267.6, "rsp": 15471.81}, {"m": "130-124-608", "d": "Laser, 445nm, 75mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 41440.0, "dist": 31640.0, "tp": 15431.65, "rsp": 14676.75}, {"m": "130-126-597", "d": "Objective Lens LVBT MI-Fluor 4x/0.3 V2", "c": "RES-IM-UM-Spare Parts", "sg": 41340.0, "dist": 27050.0, "tp": 13191.48, "rsp": 14641.85}, {"m": "200-075-620", "d": "Chamber Drive Unit CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 41060.0, "dist": 30140.0, "tp": 14700.14, "rsp": 14540.95}, {"m": "130-110-431", "d": "Laser, cyan, 488nm, 100mW, PIC", "c": "RES-CA-Spare Parts", "sg": 37840.0, "dist": 28890.0, "tp": 14091.91, "rsp": 13402.56}, {"m": "130-124-579", "d": "PIC Laser 488nm, adjusted for SO lens", "c": "RES-CA-Spare Parts", "sg": 36470.0, "dist": 26420.0, "tp": 12887.3, "rsp": 12917.78}, {"m": "130-115-173", "d": "Needle Arm Unit, MQ X", "c": "RES-CA-Spare Parts", "sg": 34600.0, "dist": 26420.0, "tp": 12885.01, "rsp": 12254.69}, {"m": "130-130-395", "d": "Stage xxl", "c": "RES-IM-UM-Spare Parts", "sg": 32970.0, "dist": 27690.0, "tp": 13504.26, "rsp": 11676.04}, {"m": "130-119-750", "d": "Laser Coherent, 50 mW, blue", "c": "RES-CA-Spare Parts", "sg": 32580.0, "dist": 24760.0, "tp": 12074.82, "rsp": 11540.42}, {"m": "130-124-808", "d": "Tyto CPC, complete", "c": "RES-CA-Spare Parts", "sg": 32170.0, "dist": 24560.0, "tp": 11980.19, "rsp": 11394.13}, {"m": "130-127-134", "d": "Optical house", "c": "RES-IM-UM-Spare Parts", "sg": 31890.0, "dist": 25490.0, "tp": 12429.3, "rsp": 11293.42}, {"m": "130-124-582", "d": "PIC Laser 405nm, adjusted for SO lens", "c": "RES-CA-Spare Parts", "sg": 31370.0, "dist": 18130.0, "tp": 8839.73, "rsp": 11110.91}, {"m": "200-075-647", "d": "Chamber Drive Unit II", "c": "CLI-CS-Spare Parts", "sg": 31040.0, "dist": 20350.0, "tp": 9922.72, "rsp": 10994.19}, {"m": "130-124-618", "d": "Laser, 532nm, 100mW, Lasos DPSS", "c": "RES-IM-UM-Spare Parts", "sg": 30940.0, "dist": 27040.0, "tp": 13186.8, "rsp": 10959.3}, {"m": "130-124-616", "d": "Laser, 561nm, 100mW, Lasos DPSS", "c": "RES-IM-UM-Spare Parts", "sg": 30660.0, "dist": 26790.0, "tp": 13064.7, "rsp": 10857.83}, {"m": "130-110-430", "d": "Laser, violet, 405nm, 100mW, PIC", "c": "RES-CA-Spare Parts", "sg": 30320.0, "dist": 18220.0, "tp": 8884.74, "rsp": 10738.52}, {"m": "130-134-253", "d": "UM Blaze Computer (Lightspeed Mode)", "c": "RES-IM-UM-Spare Parts", "sg": 30300.0, "dist": 18210.0, "tp": 8880.0, "rsp": 10732.8}, {"m": "130-127-704", "d": "SmarAct Controller MCS2", "c": "RES-IM-MACSima-Spare Parts", "sg": 29820.0, "dist": 18630.0, "tp": 9087.51, "rsp": 10561.17}, {"m": "130-097-831", "d": "Laser IMM, blue, 50 mW", "c": "RES-OT-Spare Parts", "sg": 29520.0, "dist": 17740.0, "tp": 8650.77, "rsp": 10455.73}, {"m": "130-126-235", "d": "Light sheet unit right side NKT Laser", "c": "RES-IM-UM-Spare Parts", "sg": 29510.0, "dist": 22530.0, "tp": 10989.0, "rsp": 10451.43}, {"m": "130-126-236", "d": "Light sheet unit left side NKT Laser", "c": "RES-IM-UM-Spare Parts", "sg": 29510.0, "dist": 22530.0, "tp": 10989.0, "rsp": 10451.43}, {"m": "130-127-073", "d": "XYZ stage UM Blaze", "c": "RES-IM-UM-Spare Parts", "sg": 29430.0, "dist": 22470.0, "tp": 10959.7, "rsp": 10423.56}, {"m": "130-124-615", "d": "Laser, 405nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 29210.0, "dist": 22310.0, "tp": 10878.96, "rsp": 10346.78}, {"m": "130-124-607", "d": "Laser, 515nm, 40mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 28400.0, "dist": 17400.0, "tp": 8484.01, "rsp": 10056.99}, {"m": "130-127-057", "d": "Lens holder assembly", "c": "RES-CA-Spare Parts", "sg": 28120.0, "dist": 16900.0, "tp": 8239.64, "rsp": 9958.83}, {"m": "130-123-458", "d": "MultiMACS X installation kit for cabinet", "c": "RES-CA-Spare Parts", "sg": 28030.0, "dist": 17170.0, "tp": 8373.32, "rsp": 9925.78}, {"m": "130-124-681", "d": "Laser, 445nm, 45mW, Lasos LDM-XT", "c": "RES-IM-UM-Spare Parts", "sg": 28020.0, "dist": 22160.0, "tp": 10805.85, "rsp": 9924.39}, {"m": "130-124-619", "d": "Laser, 488nm, 85mW, Lasos LDM-XT", "c": "RES-IM-UM-Spare Parts", "sg": 27990.0, "dist": 21930.0, "tp": 10695.96, "rsp": 9912.82}, {"m": "130-134-753", "d": "X-Stage Assembly", "c": "RES-CA-Spare Parts", "sg": 27390.0, "dist": 20920.0, "tp": 10200.92, "rsp": 9701.9}, {"m": "130-101-416", "d": "Laser Coherent, blue, 30 mW, Fan include", "c": "RES-OT-Spare Parts", "sg": 27350.0, "dist": 19730.0, "tp": 9619.67, "rsp": 9686.06}, {"m": "130-124-613", "d": "Laser, 515nm, 35mW, Lasos LDM-XT", "c": "RES-IM-UM-Spare Parts", "sg": 27290.0, "dist": 21030.0, "tp": 10256.4, "rsp": 9664.7}, {"m": "130-133-258", "d": "UM Blaze Computer", "c": "RES-IM-UM-Spare Parts", "sg": 27270.0, "dist": 16390.0, "tp": 7992.0, "rsp": 9659.52}, {"m": "130-133-259", "d": "UM2 Computer", "c": "RES-IM-UM-Spare Parts", "sg": 27270.0, "dist": 16390.0, "tp": 7992.0, "rsp": 9659.52}, {"m": "130-124-662", "d": "Light sheet unit right side", "c": "RES-IM-UM-Spare Parts", "sg": 26400.0, "dist": 15000.0, "tp": 7314.68, "rsp": 9350.92}, {"m": "130-124-664", "d": "Light sheet unit left side", "c": "RES-IM-UM-Spare Parts", "sg": 26400.0, "dist": 15000.0, "tp": 7314.68, "rsp": 9350.92}, {"m": "130-125-081", "d": "Tyto Cartridge Holder, complete", "c": "RES-CA-Spare Parts", "sg": 26080.0, "dist": 15670.0, "tp": 7640.72, "rsp": 9234.95}, {"m": "130-119-751", "d": "Laser IMM, 63 mW, violet", "c": "RES-CA-Spare Parts", "sg": 25180.0, "dist": 15130.0, "tp": 7379.52, "rsp": 8919.25}, {"m": "200-075-636", "d": "Back panel compl. incl. EP connection", "c": "CLI-CS-Spare Parts", "sg": 25000.0, "dist": 15020.0, "tp": 7325.8, "rsp": 8854.31}, {"m": "130-124-645", "d": "Zoom body", "c": "RES-IM-UM-Spare Parts", "sg": 24780.0, "dist": 15180.0, "tp": 7404.01, "rsp": 8776.77}, {"m": "130-122-748", "d": "Swiss Optics Objective Lens", "c": "RES-CA-Spare Parts", "sg": 24070.0, "dist": 13680.0, "tp": 6669.21, "rsp": 8525.78}, {"m": "130-117-141", "d": "Powersupply 480W EVO 100", "c": "RES-CA-Spare Parts", "sg": 23970.0, "dist": 24890.0, "tp": 12136.81, "rsp": 8487.57}, {"m": "130-120-854", "d": "PC Unit, ABECO, Tyto", "c": "RES-CA-Spare Parts", "sg": 23640.0, "dist": 14200.0, "tp": 6926.55, "rsp": 8371.76}, {"m": "130-124-659", "d": "XYZ stage UMII", "c": "RES-IM-UM-Spare Parts", "sg": 22650.0, "dist": 13870.0, "tp": 6765.75, "rsp": 8020.15}, {"m": "130-118-050", "d": "PC Unit, ABECO 4", "c": "RES-CA-Spare Parts", "sg": 22060.0, "dist": 13260.0, "tp": 6464.34, "rsp": 7813.12}, {"m": "130-118-913", "d": "Head Gripper Roma-3 EVO 100", "c": "RES-CA-Spare Parts", "sg": 21430.0, "dist": 22250.0, "tp": 10852.78, "rsp": 7589.61}, {"m": "130-126-599", "d": "Objective Lens Olympus MVPLAPO 2x", "c": "RES-IM-UM-Spare Parts", "sg": 21240.0, "dist": 13020.0, "tp": 6346.54, "rsp": 7523.21}, {"m": "130-124-807", "d": "SIE PC", "c": "RES-CA-Spare Parts", "sg": 20870.0, "dist": 11880.0, "tp": 5794.27, "rsp": 7389.29}, {"m": "130-094-758", "d": "Laser IMM, violet, 40 mW", "c": "RES-OT-Spare Parts", "sg": 20770.0, "dist": 11890.0, "tp": 5797.83, "rsp": 7357.04}, {"m": "130-115-383", "d": "Z-Axis, needle arm, MQ X", "c": "RES-CA-Spare Parts", "sg": 20550.0, "dist": 12350.0, "tp": 6020.31, "rsp": 7276.43}, {"m": "130-127-670", "d": "Bleaching Unit", "c": "RES-IM-MACSima-Spare Parts", "sg": 20520.0, "dist": 12330.0, "tp": 6012.46, "rsp": 7266.96}, {"m": "130-132-402", "d": "Bioshaker Unit for Orbital Shaker", "c": "RES-CA-Spare Parts", "sg": 20460.0, "dist": 12290.0, "tp": 5995.0, "rsp": 7245.85}, {"m": "130-126-600", "d": "Detection Unit MVX", "c": "RES-IM-UM-Spare Parts", "sg": 20040.0, "dist": 12770.0, "tp": 6227.1, "rsp": 7096.95}, {"m": "130-130-237", "d": "Door V2", "c": "RES-IM-MACSima-Spare Parts", "sg": 20000.0, "dist": 12500.0, "tp": 6094.31, "rsp": 7082.57}, {"m": "130-124-594", "d": "Tyto Door", "c": "RES-CA-Spare Parts", "sg": 19500.0, "dist": 11720.0, "tp": 5712.62, "rsp": 6904.55}, {"m": "130-124-617", "d": "Laser, 405nm, 100mW, Lasos LDM-XT", "c": "RES-IM-UM-Spare Parts", "sg": 18810.0, "dist": 14270.0, "tp": 6959.7, "rsp": 6660.45}, {"m": "130-130-243", "d": "Monitor complete 1.5.0", "c": "RES-IM-MACSima-Spare Parts", "sg": 18810.0, "dist": 12430.0, "tp": 6062.02, "rsp": 6660.77}, {"m": "200-075-506", "d": "CliniMACS Pump Assembly", "c": "CLI-CS-Spare Parts", "sg": 18600.0, "dist": 11180.0, "tp": 5449.12, "rsp": 6586.07}, {"m": "130-124-580", "d": "Pic Laser 638nm, adjusted for SO lens", "c": "RES-CA-Spare Parts", "sg": 18600.0, "dist": 11170.0, "tp": 5448.53, "rsp": 6585.35}, {"m": "130-130-392", "d": "Z-Drive Unit Detection", "c": "RES-IM-UM-Spare Parts", "sg": 18560.0, "dist": 12270.0, "tp": 5982.9, "rsp": 6573.84}, {"m": "130-127-729", "d": "Display HMI-L Connect", "c": "RES-IM-MACSima-Spare Parts", "sg": 18540.0, "dist": 11140.0, "tp": 5433.32, "rsp": 6566.98}, {"m": "130-126-644", "d": "Objective lens 12x NA 0.53 MI PLAN SK", "c": "RES-IM-UM-Spare Parts", "sg": 18360.0, "dist": 15300.0, "tp": 7459.2, "rsp": 6503.11}, {"m": "130-124-604", "d": "Laser, 640nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 18230.0, "dist": 11170.0, "tp": 5445.12, "rsp": 6454.68}, {"m": "130-114-971", "d": "Camera assembly", "c": "RES-CA-Spare Parts", "sg": 17610.0, "dist": 10580.0, "tp": 5160.43, "rsp": 6237.14}, {"m": "200-075-563", "d": "HMI, 8.4\" CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 17510.0, "dist": 10170.0, "tp": 4958.43, "rsp": 6201.74}, {"m": "130-117-891", "d": "Needle Arm Plus", "c": "RES-CA-Spare Parts", "sg": 17370.0, "dist": 10440.0, "tp": 5088.8, "rsp": 6150.57}, {"m": "130-123-123", "d": "MACSQuant Integration Kit for Cytomat", "c": "RES-CA-Spare Parts", "sg": 17320.0, "dist": 10410.0, "tp": 5074.66, "rsp": 6133.48}, {"m": "130-126-654", "d": "HMI-M Orange Gen 2.1", "c": "RES-CA-Spare Parts", "sg": 16960.0, "dist": 11420.0, "tp": 5570.39, "rsp": 6004.64}, {"m": "130-132-893", "d": "MACS MiniSampler S incl Cover", "c": "RES-CA-Spare Parts", "sg": 16800.0, "dist": 10840.0, "tp": 5283.14, "rsp": 5950.44}, {"m": "200-075-682", "d": "Interlayer Camera II", "c": "CLI-CS-Spare Parts", "sg": 16680.0, "dist": 6190.0, "tp": 3018.35, "rsp": 5907.81}, {"m": "130-110-432", "d": "Laser, red, 638nm, 100mW, PIC", "c": "RES-CA-Spare Parts", "sg": 16600.0, "dist": 10170.0, "tp": 4957.69, "rsp": 5876.86}, {"m": "135-120-854", "d": "PC Unit, ABECO, Tyto", "c": "RES-CA-Spare Parts", "sg": 16550.0, "dist": 9940.0, "tp": 4848.57, "rsp": 5860.23}, {"m": "130-118-912", "d": "Motor DC Arm Liha X-Axis EVO 100", "c": "RES-CA-Spare Parts", "sg": 16530.0, "dist": 15790.0, "tp": 7698.81, "rsp": 5855.26}, {"m": "130-122-791", "d": "COVER ACRYLIC TOP EVO 100", "c": "RES-CS-Spare Parts", "sg": 16230.0, "dist": 15500.0, "tp": 7557.01, "rsp": 5747.42}, {"m": "130-122-789", "d": "FWO+SPO STANDARD EVO 100", "c": "RES-CS-Spare Parts", "sg": 16220.0, "dist": 15490.0, "tp": 7553.03, "rsp": 5744.38}, {"m": "200-075-686", "d": "HMI-M assembly Gen 2", "c": "CLI-CS-Spare Parts", "sg": 16220.0, "dist": 9680.0, "tp": 4719.2, "rsp": 5742.1}, {"m": "130-127-741", "d": "Miniscale Plus 470 Y-Axis", "c": "RES-IM-MACSima-Spare Parts", "sg": 16050.0, "dist": 4650.0, "tp": 2264.27, "rsp": 5684.82}, {"m": "200-075-640", "d": "Gas Mix Block", "c": "CLI-CS-Spare Parts", "sg": 15600.0, "dist": 5790.0, "tp": 2823.41, "rsp": 5522.9}, {"m": "135-118-050", "d": "PC Unit, ABECO 4", "c": "RES-CA-Spare Parts", "sg": 15450.0, "dist": 9280.0, "tp": 4525.04, "rsp": 5469.18}, {"m": "200-075-690", "d": "TCU with TEC6 board and adapter kit", "c": "CLI-CS-Spare Parts", "sg": 14900.0, "dist": 8950.0, "tp": 4365.59, "rsp": 5276.47}, {"m": "130-094-755", "d": "Needle Arm Unit, EMC", "c": "RES-OT-Spare Parts", "sg": 14820.0, "dist": 8870.0, "tp": 4326.47, "rsp": 5248.88}, {"m": "130-109-820", "d": "PC Unit, ABECO 2, MQ", "c": "RES-OT-Spare Parts", "sg": 14780.0, "dist": 12790.0, "tp": 6235.74, "rsp": 5233.43}, {"m": "130-095-022", "d": "Objective Assembly", "c": "RES-OT-Spare Parts", "sg": 14610.0, "dist": 8420.0, "tp": 4103.19, "rsp": 5173.22}, {"m": "130-096-661", "d": "FL8 Upgrade Kit", "c": "RES-OT-Spare Parts", "sg": 14560.0, "dist": 5060.0, "tp": 2467.79, "rsp": 5154.01}, {"m": "130-118-213", "d": "Cooling Unit Assembly with shipping box", "c": "RES-CA-Spare Parts", "sg": 14550.0, "dist": 8750.0, "tp": 4263.62, "rsp": 5153.22}, {"m": "130-124-193", "d": "BSC Module ver2 with ABLR, grounded", "c": "RES-CA-Spare Parts", "sg": 14530.0, "dist": 8730.0, "tp": 4255.48, "rsp": 5143.38}, {"m": "130-126-713", "d": "PSD/4 Syringe Pump High Current", "c": "RES-CS-Spare Parts", "sg": 14360.0, "dist": 5200.0, "tp": 2536.5, "rsp": 5083.41}, {"m": "130-124-614", "d": "Laser, 639nm, 70mW, Lasos LDM-XT", "c": "RES-IM-UM-Spare Parts", "sg": 14310.0, "dist": 8770.0, "tp": 4273.5, "rsp": 5065.83}, {"m": "130-124-620", "d": "Laser, 785nm, 80mW, Lasos LDM-XT", "c": "RES-IM-UM-Spare Parts", "sg": 14310.0, "dist": 8770.0, "tp": 4273.5, "rsp": 5065.83}, {"m": "130-128-757", "d": "Needle Arm default aMp", "c": "RES-CA-Spare Parts", "sg": 14290.0, "dist": 8590.0, "tp": 4187.62, "rsp": 5061.37}, {"m": "130-122-788", "d": "OPTION DITI EJECT LOW 3 LIHA EVO 100", "c": "RES-CA-Spare Parts", "sg": 13970.0, "dist": 13340.0, "tp": 6505.12, "rsp": 4947.41}, {"m": "200-075-539", "d": "Pump assembly CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 13890.0, "dist": 9270.0, "tp": 4520.72, "rsp": 4919.7}, {"m": "200-075-628", "d": "Tube Sealer CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 13880.0, "dist": 8340.0, "tp": 4064.97, "rsp": 4913.12}, {"m": "130-120-842", "d": "Powersupply 480W EVO 2", "c": "RES-CA-Spare Parts", "sg": 13790.0, "dist": 13170.0, "tp": 6421.13, "rsp": 4883.53}, {"m": "130-117-330", "d": "Diluter XP Smart II EVO 100", "c": "RES-CA-Spare Parts", "sg": 13770.0, "dist": 13150.0, "tp": 6410.27, "rsp": 4875.27}, {"m": "130-114-783", "d": "Extended MiniSampler", "c": "RES-CA-Spare Parts", "sg": 13760.0, "dist": 5390.0, "tp": 2626.96, "rsp": 4873.66}, {"m": "130-094-737", "d": "Control Unit, MQ", "c": "RES-OT-Spare Parts", "sg": 13740.0, "dist": 4860.0, "tp": 2369.41, "rsp": 4864.9}, {"m": "200-075-617", "d": "PC Unit, B&R, CliniMACS", "c": "CLI-CS-Spare Parts", "sg": 13720.0, "dist": 4900.0, "tp": 2387.74, "rsp": 4856.79}, {"m": "200-075-558", "d": "Temperature Conditioning Unit CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 13680.0, "dist": 7950.0, "tp": 3873.99, "rsp": 4845.39}, {"m": "130-124-606", "d": "Laser, 785nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 13600.0, "dist": 8330.0, "tp": 4062.6, "rsp": 4815.83}, {"m": "130-128-340", "d": "maintenance kit APRO/ANEO (Hamilton)", "c": "RES-CA-Spare Parts", "sg": 13540.0, "dist": 5300.0, "tp": 2582.08, "rsp": 4793.88}, {"m": "200-075-778", "d": "Monitor, LIFE21", "c": "CLI-PP-Spare Parts", "sg": 13530.0, "dist": 8130.0, "tp": 3963.22, "rsp": 4790.14}, {"m": "130-135-460", "d": "Tyto door with insulation and handle", "c": "RES-IM-Spare Parts", "sg": 13490.0, "dist": 4820.0, "tp": 2348.11, "rsp": 4776.19}, {"m": "130-126-672", "d": "Needle Arm aMneo", "c": "RES-CA-Spare Parts", "sg": 13390.0, "dist": 10310.0, "tp": 5026.45, "rsp": 4742.46}, {"m": "130-115-160", "d": "Cartridge Holder Actuator left", "c": "RES-CA-Spare Parts", "sg": 13340.0, "dist": 4760.0, "tp": 2321.71, "rsp": 4722.49}, {"m": "200-075-662", "d": "Rotation Socket MaxSize Chamber", "c": "CLI-CS-Spare Parts", "sg": 13290.0, "dist": 5490.0, "tp": 2674.55, "rsp": 4707.08}, {"m": "130-124-390", "d": "MultiMACS drive unit", "c": "RES-CS-Spare Parts", "sg": 13250.0, "dist": 8400.0, "tp": 4095.7, "rsp": 4692.64}, {"m": "130-124-391", "d": "MultiMACS magnet unit", "c": "RES-CS-Spare Parts", "sg": 13250.0, "dist": 8400.0, "tp": 4095.7, "rsp": 4692.64}, {"m": "130-122-790", "d": "DISPLAY STATUS EVO 100", "c": "RES-CS-Spare Parts", "sg": 13210.0, "dist": 12610.0, "tp": 6149.55, "rsp": 4676.98}, {"m": "130-118-045", "d": "HMI Control Display 15.6\"", "c": "RES-CA-Spare Parts", "sg": 13210.0, "dist": 7670.0, "tp": 3739.52, "rsp": 4677.18}, {"m": "200-075-751", "d": "Power Supply, LIFE21", "c": "CLI-PP-Spare Parts", "sg": 13200.0, "dist": 5020.0, "tp": 2444.53, "rsp": 4674.0}, {"m": "200-075-695", "d": "HMI incl. PC Unit", "c": "CLI-CS-Spare Parts", "sg": 13180.0, "dist": 7920.0, "tp": 3859.9, "rsp": 4665.25}, {"m": "130-118-041", "d": "Touch Control Unit, 2 USB ports", "c": "RES-CA-Spare Parts", "sg": 13160.0, "dist": 4700.0, "tp": 2290.86, "rsp": 4659.74}, {"m": "130-132-804", "d": "Lichtleiterkabel 405 - 640", "c": "RES-IM-UM-Spare Parts", "sg": 13140.0, "dist": 4700.0, "tp": 2288.14, "rsp": 4654.2}, {"m": "130-124-648", "d": "Coarse and fine drive Olympus", "c": "RES-IM-UM-Spare Parts", "sg": 13110.0, "dist": 7880.0, "tp": 3840.6, "rsp": 4641.94}, {"m": "130-133-127", "d": "Dilutor Unit PSD", "c": "RES-IM-MACSima-Spare Parts", "sg": 13100.0, "dist": 7870.0, "tp": 3836.53, "rsp": 4637.02}, {"m": "130-114-782", "d": "MiniSampler, Plus (spare part)", "c": "RES-CA-Spare Parts", "sg": 12850.0, "dist": 4590.0, "tp": 2236.5, "rsp": 4549.17}, {"m": "130-097-853", "d": "Pump Unit, v3", "c": "RES-OT-Spare Parts", "sg": 12800.0, "dist": 4520.0, "tp": 2202.31, "rsp": 4532.26}, {"m": "130-124-386", "d": "Display Gen2, 15.6\", Abeco 4", "c": "RES-CA-Spare Parts", "sg": 12780.0, "dist": 7440.0, "tp": 3628.37, "rsp": 4524.91}, {"m": "130-115-114", "d": "Cartridge Holder Actuator right", "c": "RES-CA-Spare Parts", "sg": 12660.0, "dist": 4950.0, "tp": 2413.07, "rsp": 4483.97}, {"m": "200-075-002", "d": "CliniMACS Pump Assembly CS3", "c": "CLI-CS-Spare Parts", "sg": 12630.0, "dist": 7590.0, "tp": 3699.74, "rsp": 4471.69}, {"m": "200-075-557", "d": "Upper Chamber Adapter CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 12630.0, "dist": 4740.0, "tp": 2307.34, "rsp": 4471.61}, {"m": "130-126-598", "d": "Objective Lens 1.1x NA 0.1 MI PLAN SK", "c": "RES-IM-UM-Spare Parts", "sg": 12540.0, "dist": 7540.0, "tp": 3674.1, "rsp": 4440.7}, {"m": "130-094-935", "d": "FPGA Board, Cesys", "c": "RES-OT-Spare Parts", "sg": 12540.0, "dist": 4480.0, "tp": 2183.55, "rsp": 4441.47}, {"m": "130-096-778", "d": "gentleMACS Octo BLDC Board Motor Module", "c": "RES-SP-Spare Parts", "sg": 12540.0, "dist": 4480.0, "tp": 2183.28, "rsp": 4440.9}, {"m": "200-075-527", "d": "CliniMACS PC Unit", "c": "CLI-CS-Spare Parts", "sg": 12470.0, "dist": 7500.0, "tp": 3653.68, "rsp": 4416.01}, {"m": "130-114-807", "d": "Solenoid Assembly", "c": "RES-CA-Spare Parts", "sg": 12460.0, "dist": 4730.0, "tp": 2302.49, "rsp": 4411.91}, {"m": "130-096-784", "d": "gentleMACS Octo Housing middle part", "c": "RES-SP-Spare Parts", "sg": 12400.0, "dist": 4430.0, "tp": 2157.84, "rsp": 4389.16}, {"m": "130-110-221", "d": "Photomultiplier Module, Type -20, Gen.2", "c": "RES-CA-Spare Parts", "sg": 12390.0, "dist": 4430.0, "tp": 2157.14, "rsp": 4387.73}, {"m": "130-132-392", "d": "Artesyn Power Supply uMP16", "c": "RES-IM-MACSima-Spare Parts", "sg": 12380.0, "dist": 4420.0, "tp": 2154.53, "rsp": 4382.43}, {"m": "130-134-724", "d": "HMI-L 3. Gen. for Tyto and Quant", "c": "RES-CA-Spare Parts", "sg": 12360.0, "dist": 7430.0, "tp": 3621.45, "rsp": 4377.06}, {"m": "130-128-494", "d": "Positioner 26mm SLC-2445 (Y-Stage) vers2", "c": "RES-CA-Spare Parts", "sg": 12310.0, "dist": 7400.0, "tp": 3605.08, "rsp": 4357.27}, {"m": "200-075-566", "d": "Control Unit CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 12270.0, "dist": 5330.0, "tp": 2599.25, "rsp": 4343.91}, {"m": "130-118-209", "d": "Panel PC, HAWK AP 10-BT, PCT", "c": "RES-CS-Spare Parts", "sg": 12230.0, "dist": 7350.0, "tp": 3583.38, "rsp": 4331.04}, {"m": "130-128-496", "d": "Positioner 46mm SLC-2475 (X-Stage) vers2", "c": "RES-CA-Spare Parts", "sg": 12140.0, "dist": 7290.0, "tp": 3555.07, "rsp": 4296.83}, {"m": "130-110-216", "d": "Photomultiplier Module, Type -01, Gen.2", "c": "RES-CA-Spare Parts", "sg": 12080.0, "dist": 4320.0, "tp": 2103.02, "rsp": 4277.66}, {"m": "200-075-006", "d": "CliniMACS Electronics CS3", "c": "CLI-CS-Spare Parts", "sg": 11850.0, "dist": 5170.0, "tp": 2519.9, "rsp": 4196.55}, {"m": "200-075-685", "d": "Internal Control Computer ICC Unit Gen2", "c": "CLI-CS-Spare Parts", "sg": 11830.0, "dist": 5240.0, "tp": 2552.85, "rsp": 4189.09}, {"m": "130-128-495", "d": "Positioner 18mm SLC-1730 (Z-Stage) vers2", "c": "RES-CA-Spare Parts", "sg": 11790.0, "dist": 7090.0, "tp": 3454.99, "rsp": 4175.86}, {"m": "130-115-385", "d": "Sheath Reservoir Unit", "c": "RES-CA-Spare Parts", "sg": 11790.0, "dist": 7080.0, "tp": 3453.54, "rsp": 4174.12}, {"m": "130-115-112", "d": "FPGA Board, Trenz, SATA", "c": "RES-CA-Spare Parts", "sg": 11720.0, "dist": 5150.0, "tp": 2507.9, "rsp": 4148.22}, {"m": "130-110-212", "d": "Linear positioner SLC-2445 (Y-Stage)", "c": "RES-CA-Spare Parts", "sg": 11690.0, "dist": 7020.0, "tp": 3423.15, "rsp": 4137.38}, {"m": "130-110-223", "d": "Linear positioner SLC-2475 (X-Stage)", "c": "RES-CA-Spare Parts", "sg": 11690.0, "dist": 7020.0, "tp": 3423.89, "rsp": 4138.27}, {"m": "130-124-666", "d": "Filter wheel excitation for NKT Laser", "c": "RES-IM-UM-Spare Parts", "sg": 11660.0, "dist": 4170.0, "tp": 2029.73, "rsp": 4128.59}, {"m": "130-124-605", "d": "Laser, 660nm, 100mW, Coherent OBIS", "c": "RES-IM-UM-Spare Parts", "sg": 11650.0, "dist": 7140.0, "tp": 3479.46, "rsp": 4124.56}, {"m": "130-125-303", "d": "CapBank HV Assembly", "c": "CLI-CS-Spare Parts", "sg": 11610.0, "dist": 4810.0, "tp": 2343.03, "rsp": 4109.58}, {"m": "130-127-588", "d": "X- stage, complete", "c": "RES-IM-MACSima-Spare Parts", "sg": 11590.0, "dist": 4140.0, "tp": 2016.89, "rsp": 4102.47}, {"m": "130-124-663", "d": "Splitting mirror module right side", "c": "RES-IM-UM-Spare Parts", "sg": 11540.0, "dist": 7070.0, "tp": 3446.7, "rsp": 4085.74}, {"m": "130-125-795", "d": "Splitting mirror module left side", "c": "RES-IM-UM-Spare Parts", "sg": 11540.0, "dist": 7070.0, "tp": 3446.7, "rsp": 4085.74}, {"m": "130-125-292", "d": "Coil Board", "c": "CLI-CS-Spare Parts", "sg": 11540.0, "dist": 4120.0, "tp": 2008.08, "rsp": 4084.55}, {"m": "130-127-133", "d": "Sheet width telescope module", "c": "RES-IM-UM-Spare Parts", "sg": 11450.0, "dist": 4400.0, "tp": 2142.12, "rsp": 4052.66}, {"m": "130-127-136", "d": "Flip mirror module", "c": "RES-IM-UM-Spare Parts", "sg": 11450.0, "dist": 4400.0, "tp": 2142.12, "rsp": 4052.66}, {"m": "130-133-959", "d": "Excit. module (Filter wheel/Attenuator)", "c": "RES-IM-UM-Spare Parts", "sg": 11420.0, "dist": 6870.0, "tp": 3346.87, "rsp": 4045.19}, {"m": "130-126-588", "d": "Dipping Cap 12x Water SK", "c": "RES-IM-UM-Spare Parts", "sg": 11380.0, "dist": 4060.0, "tp": 1980.22, "rsp": 4027.87}, {"m": "130-126-591", "d": "Dipping Cap 12x Aqueous Buffers SK", "c": "RES-IM-UM-Spare Parts", "sg": 11380.0, "dist": 4060.0, "tp": 1980.22, "rsp": 4027.87}, {"m": "130-126-592", "d": "Dipping Cap 12x Organic Solvent SK", "c": "RES-IM-UM-Spare Parts", "sg": 11380.0, "dist": 4060.0, "tp": 1980.22, "rsp": 4027.87}, {"m": "130-124-658", "d": "Cuvette", "c": "RES-IM-UM-Spare Parts", "sg": 11370.0, "dist": 6830.0, "tp": 3330.0, "rsp": 4024.8}, {"m": "130-130-400", "d": "XXL Chamber", "c": "RES-IM-UM-Spare Parts", "sg": 11350.0, "dist": 4460.0, "tp": 2173.38, "rsp": 4018.88}, {"m": "130-119-463", "d": "Nikon Objective Lens", "c": "RES-CA-Spare Parts", "sg": 11350.0, "dist": 6820.0, "tp": 3325.99, "rsp": 4019.94}, {"m": "130-121-529", "d": "Swiss Optics, Lens Cover", "c": "RES-CA-Spare Parts", "sg": 11330.0, "dist": 5010.0, "tp": 2442.09, "rsp": 4010.54}, {"m": "200-075-762", "d": "Dual processor PCB", "c": "CLI-PP-Spare Parts", "sg": 11300.0, "dist": 4160.0, "tp": 2026.71, "rsp": 3999.17}, {"m": "130-111-577", "d": "Linear positioner SLC-1730 (Z-Stage)", "c": "RES-CA-Spare Parts", "sg": 11290.0, "dist": 6790.0, "tp": 3308.73, "rsp": 3999.09}, {"m": "200-075-508", "d": "CliniMACS Magnet Drive Assembly", "c": "CLI-CS-Spare Parts", "sg": 11100.0, "dist": 6670.0, "tp": 3250.43, "rsp": 3928.63}, {"m": "130-125-297", "d": "CapBank LV Assembly", "c": "CLI-CS-Spare Parts", "sg": 11060.0, "dist": 4720.0, "tp": 2298.85, "rsp": 3915.7}, {"m": "130-128-342", "d": "Maintenance Kit, aMP (/w TECAN Cavro XP)", "c": "RES-CA-Spare Parts", "sg": 11000.0, "dist": 3930.0, "tp": 1914.57, "rsp": 3894.33}, {"m": "200-075-519", "d": "CliniMACS Housing CS2", "c": "CLI-CS-Spare Parts", "sg": 10950.0, "dist": 5340.0, "tp": 2600.18, "rsp": 3877.86}, {"m": "130-093-343", "d": "PC Unit with Display and Touchscreen", "c": "RES-CS-Spare Parts", "sg": 10940.0, "dist": 3910.0, "tp": 1904.54, "rsp": 3873.93}, {"m": "130-120-669", "d": "Cooling Chamber", "c": "RES-CA-Spare Parts", "sg": 10930.0, "dist": 3910.0, "tp": 1902.89, "rsp": 3870.58}, {"m": "200-075-511", "d": "CliniMACS Electronics", "c": "CLI-CS-Spare Parts", "sg": 10860.0, "dist": 3880.0, "tp": 1890.66, "rsp": 3845.71}, {"m": "130-098-225", "d": "PC Unit, ABECO, MQ", "c": "RES-CA-Spare Parts", "sg": 10750.0, "dist": 6720.0, "tp": 3273.63, "rsp": 3804.49}, {"m": "130-128-490", "d": "Hardware Autofocus", "c": "RES-IM-MACSima-Spare Parts", "sg": 10700.0, "dist": 7070.0, "tp": 3447.25, "rsp": 3787.74}, {"m": "130-127-564", "d": "autoMACS NEO 1.1 Large Magnet unit cpl.", "c": "RES-CA-Spare Parts", "sg": 10620.0, "dist": 3790.0, "tp": 1848.52, "rsp": 3759.99}, {"m": "330-001-005", "d": "Power Supply V2.4", "c": "CLI-PP-Spare Parts", "sg": 10570.0, "dist": 6350.0, "tp": 3097.42, "rsp": 3743.69}, {"m": "130-133-190", "d": "Quattro Pump Unit", "c": "RES-IM-MACSima-Spare Parts", "sg": 10520.0, "dist": 3760.0, "tp": 1830.41, "rsp": 3723.15}, {"m": "200-075-745", "d": "Umbilical supply cable", "c": "CLI-CS-Spare Parts", "sg": 10520.0, "dist": 3760.0, "tp": 1830.48, "rsp": 3723.3}, {"m": "200-075-666", "d": "DoPro30-DiBo25 combination", "c": "CLI-PP-Spare Parts", "sg": 10510.0, "dist": 6470.0, "tp": 3154.51, "rsp": 3720.03}, {"m": "130-127-739", "d": "Barcode Reader complete", "c": "RES-IM-MACSima-Spare Parts", "sg": 10490.0, "dist": 6550.0, "tp": 3194.45, "rsp": 3712.49}, {"m": "130-127-592", "d": "Y- stage, complete", "c": "RES-IM-MACSima-Spare Parts", "sg": 10490.0, "dist": 6300.0, "tp": 3072.54, "rsp": 3713.61}, {"m": "130-124-408", "d": "PCBA Ilid LIHA EVO 100", "c": "RES-CA-Spare Parts", "sg": 10480.0, "dist": 10000.0, "tp": 4876.91, "rsp": 3709.09}, {"m": "135-109-820", "d": "PC Unit, ABECO 2, MQ", "c": "RES-OT-Spare Parts", "sg": 10350.0, "dist": 8950.0, "tp": 4365.02, "rsp": 3663.4}, {"m": "130-135-461", "d": "Solenoid-Driver Assembly", "c": "RES-IM-Spare Parts", "sg": 10340.0, "dist": 3690.0, "tp": 1799.94, "rsp": 3661.18}, {"m": "130-127-726", "d": "Y-Axis, Needle Arm", "c": "RES-IM-MACSima-Spare Parts", "sg": 10280.0, "dist": 6430.0, "tp": 3133.22, "rsp": 3641.3}, {"m": "130-128-337", "d": "SmarAct Control Board vers2", "c": "RES-CA-Spare Parts", "sg": 10280.0, "dist": 3670.0, "tp": 1789.01, "rsp": 3638.94}, {"m": "135-124-193", "d": "BSC Module ver2 with ABLR, grounded", "c": "RES-CA-Spare Parts", "sg": 10170.0, "dist": 6110.0, "tp": 2978.83, "rsp": 3600.37}, {"m": "130-101-418", "d": "Control board, coherent laser", "c": "RES-OT-Spare Parts", "sg": 10130.0, "dist": 3620.0, "tp": 1763.66, "rsp": 3587.38}, {"m": "130-119-716", "d": "Pump Unit Uptake Module MQ X", "c": "RES-CA-Spare Parts", "sg": 10070.0, "dist": 3600.0, "tp": 1752.99, "rsp": 3565.67}, {"m": "130-124-389", "d": "Elution complete control unit", "c": "RES-CS-Spare Parts", "sg": 9970.0, "dist": 3870.0, "tp": 1886.85, "rsp": 3529.24}, {"m": "130-127-129", "d": "Cuvette Standard", "c": "RES-IM-UM-Spare Parts", "sg": 9810.0, "dist": 6130.0, "tp": 2989.01, "rsp": 3473.71}, {"m": "130-119-749", "d": "Laser IMM, red, 70 mW", "c": "RES-CA-Spare Parts", "sg": 9770.0, "dist": 5870.0, "tp": 2861.6, "rsp": 3458.67}, {"m": "130-132-969", "d": "Half Yearly Maintenance Kit, MACSima", "c": "RES-IM-MACSima-Spare Parts", "sg": 9740.0, "dist": 5850.0, "tp": 2853.51, "rsp": 3448.9}, {"m": "200-075-578", "d": "Power supply CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 9740.0, "dist": 5850.0, "tp": 2852.13, "rsp": 3447.22}, {"m": "130-132-885", "d": "Screw M3x12mm", "c": "RES-IM-Spare Parts", "sg": 40.0, "dist": 20.0, "tp": 5.35, "rsp": 13.93}, {"m": "130-127-059", "d": "Sample Holder Standard", "c": "RES-IM-Spare Parts", "sg": 4260.0, "dist": 1640.0, "tp": 797.07, "rsp": 1507.97}, {"m": "130-135-473", "d": "8x Reagent Rack", "c": "RES-IM-Spare Parts", "sg": 2670.0, "dist": 960.0, "tp": 464.41, "rsp": 944.63}, {"m": "130-135-183", "d": "UMB Designhood Stand", "c": "RES-IM-Spare Parts", "sg": 5410.0, "dist": 1940.0, "tp": 941.84, "rsp": 1915.75}, {"m": "130-136-288", "d": "5V Stabilizer", "c": "RES-IM-Spare Parts", "sg": 2730.0, "dist": 980.0, "tp": 474.93, "rsp": 966.04}, {"m": "130-136-295", "d": "Servicekit Linear Guide", "c": "RES-IM-Spare Parts", "sg": 3920.0, "dist": 1400.0, "tp": 681.76, "rsp": 1386.75}, {"m": "130-135-478", "d": "Beamsplitter cube assembly 10%", "c": "RES-IM-Spare Parts", "sg": 3870.0, "dist": 1380.0, "tp": 672.97, "rsp": 1368.86}, {"m": "130-135-184", "d": "O Ring Sheath Adapter Size 5x1,75", "c": "RES-IM-Spare Parts", "sg": 60.0, "dist": 20.0, "tp": 7.31, "rsp": 20.94}, {"m": "130-135-458", "d": "Mounting Parts for FPGA Fan", "c": "RES-IM-Spare Parts", "sg": 130.0, "dist": 40.0, "tp": 14.84, "rsp": 42.53}, {"m": "130-135-480", "d": "Laser Spacing Solution for Tyto-Lux", "c": "RES-IM-Spare Parts", "sg": 320.0, "dist": 90.0, "tp": 39.41, "rsp": 112.94}, {"m": "130-135-469", "d": "Gap Pad, Cut for CAN LED Board", "c": "RES-IM-Spare Parts", "sg": 450.0, "dist": 120.0, "tp": 54.82, "rsp": 157.1}, {"m": "130-135-185", "d": "UM2 Piezo mirror electronic", "c": "RES-IM-Spare Parts", "sg": 1020.0, "dist": 260.0, "tp": 125.76, "rsp": 360.43}, {"m": "130-135-464", "d": "Achromate", "c": "RES-IM-Spare Parts", "sg": 1330.0, "dist": 340.0, "tp": 163.72, "rsp": 469.23}, {"m": "130-135-468", "d": "Spring plunger, Magnet unit", "c": "RES-IM-Spare Parts", "sg": 30.0, "dist": 10.0, "tp": 3.18, "rsp": 9.12}, {"m": "130-135-454", "d": "Constant force spring assembly", "c": "RES-IM-Spare Parts", "sg": 280.0, "dist": 70.0, "tp": 34.11, "rsp": 97.77}, {"m": "130-132-986", "d": "Fine fuse, 5x20mm, 4.0A rated (10pcs)", "c": "RES-IM-UM-Spare Parts", "sg": 10.0, "dist": 10.0, "tp": 0.63, "rsp": 1.8}, {"m": "130-127-153", "d": "3rd Mirror Split. Mod. Left (NKT)", "c": "RES-IM-UM-Spare Parts", "sg": 1780.0, "dist": 1380.0, "tp": 672.53, "rsp": 627.09}, {"m": "130-124-622", "d": "Alignment tool", "c": "RES-IM-UM-Spare Parts", "sg": 5090.0, "dist": 2320.0, "tp": 1127.09, "rsp": 1799.85}, {"m": "130-130-401", "d": "Filling Aid for Cuvette large", "c": "RES-IM-UM-Spare Parts", "sg": 1280.0, "dist": 510.0, "tp": 244.2, "rsp": 451.56}, {"m": "130-130-405", "d": "Ears for Cuvette large", "c": "RES-IM-UM-Spare Parts", "sg": 1280.0, "dist": 510.0, "tp": 244.2, "rsp": 451.56}, {"m": "130-130-409", "d": "Sampler Holder large", "c": "RES-IM-UM-Spare Parts", "sg": 1530.0, "dist": 610.0, "tp": 293.04, "rsp": 541.87}, {"m": "130-130-408", "d": "Sample Holder Arm large", "c": "RES-IM-UM-Spare Parts", "sg": 1790.0, "dist": 710.0, "tp": 341.88, "rsp": 632.18}, {"m": "130-130-809", "d": "UMB Sample Holder Arm Std", "c": "RES-IM-UM-Spare Parts", "sg": 1790.0, "dist": 710.0, "tp": 341.88, "rsp": 632.18}, {"m": "130-127-071", "d": "Piezo mirror electronics", "c": "RES-IM-UM-Spare Parts", "sg": 1730.0, "dist": 680.0, "tp": 329.67, "rsp": 609.61}, {"m": "130-127-060", "d": "End switch pillar", "c": "RES-IM-UM-Spare Parts", "sg": 1600.0, "dist": 620.0, "tp": 298.9, "rsp": 565.49}, {"m": "130-127-065", "d": "Single step controller board 1MS PF2", "c": "RES-IM-UM-Spare Parts", "sg": 1600.0, "dist": 620.0, "tp": 298.9, "rsp": 565.49}, {"m": "130-127-137", "d": "Routing mirror for NKT laser", "c": "RES-IM-UM-Spare Parts", "sg": 3660.0, "dist": 1410.0, "tp": 684.98, "rsp": 1295.91}, {"m": "130-127-061", "d": "Power supply", "c": "RES-IM-UM-Spare Parts", "sg": 4000.0, "dist": 1540.0, "tp": 747.25, "rsp": 1413.72}, {"m": "130-127-076", "d": "1st/4th Mirror Split. Mod. (NKT/BC)", "c": "RES-IM-UM-Spare Parts", "sg": 4400.0, "dist": 1690.0, "tp": 821.97, "rsp": 1555.09}, {"m": "130-127-072", "d": "3rd Mirror Split. Mod. Right (BC)", "c": "RES-IM-UM-Spare Parts", "sg": 3600.0, "dist": 1380.0, "tp": 672.53, "rsp": 1272.35}, {"m": "130-123-105", "d": "Cable Flex Y-Axis Roma EVO 100", "c": "RES-CS-Spare Parts", "sg": 940.0, "dist": 840.0, "tp": 407.46, "rsp": 330.36}, {"m": "130-121-516", "d": "PCBA DEVICE DCU BOARD II EVO 100", "c": "RES-CS-Spare Parts", "sg": 4960.0, "dist": 4120.0, "tp": 2005.97, "rsp": 1756.59}, {"m": "130-105-969", "d": "Elution Chamber Base", "c": "RES-CS-Spare Parts", "sg": 1270.0, "dist": 520.0, "tp": 250.73, "rsp": 446.81}, {"m": "130-105-955", "d": "Elution PCB VES-Control-Board", "c": "RES-CS-Spare Parts", "sg": 2480.0, "dist": 1000.0, "tp": 487.4, "rsp": 876.13}, {"m": "130-124-382", "d": "MultiMACS column unit", "c": "RES-CS-Spare Parts", "sg": 7710.0, "dist": 3050.0, "tp": 1484.74, "rsp": 2729.3}, {"m": "130-122-792", "d": "MultiMACS display unit", "c": "RES-CS-Spare Parts", "sg": 7490.0, "dist": 2950.0, "tp": 1434.99, "rsp": 2651.95}, {"m": "130-105-970", "d": "Elution Chamber Lid II", "c": "RES-CS-Spare Parts", "sg": 2130.0, "dist": 830.0, "tp": 400.16, "rsp": 751.25}, {"m": "130-093-336", "d": "Z-Axis Motor, needle arm", "c": "RES-CS-Spare Parts", "sg": 1810.0, "dist": 700.0, "tp": 337.2, "rsp": 638.53}, {"m": "130-093-306", "d": "autoMACS Pro Bottle Closure, black", "c": "RES-CS-Spare Parts", "sg": 1200.0, "dist": 460.0, "tp": 223.52, "rsp": 424.94}, {"m": "130-093-245", "d": "autoMACS Pro Angle Connector, set", "c": "RES-CS-Spare Parts", "sg": 1640.0, "dist": 620.0, "tp": 301.05, "rsp": 577.7}, {"m": "130-093-353", "d": "autoMACS Pro Fluidic Control Board", "c": "RES-CS-Spare Parts", "sg": 5950.0, "dist": 2200.0, "tp": 1070.41, "rsp": 2105.41}, {"m": "130-093-341", "d": "Pump Unit", "c": "RES-CS-Spare Parts", "sg": 6000.0, "dist": 3490.0, "tp": 1697.86, "rsp": 2124.49}, {"m": "130-093-304", "d": "autoMACS Pro Bottle Closure, green", "c": "RES-CS-Spare Parts", "sg": 1300.0, "dist": 470.0, "tp": 226.37, "rsp": 460.44}, {"m": "130-090-339", "d": "Pump syringe", "c": "RES-CS-Spare Parts", "sg": 1440.0, "dist": 520.0, "tp": 250.56, "rsp": 509.66}, {"m": "130-093-339", "d": "Conductive Glue", "c": "RES-CS-Spare Parts", "sg": 1220.0, "dist": 440.0, "tp": 211.77, "rsp": 430.75}, {"m": "130-094-746", "d": "Power Supply, incl. fuse board, MQ", "c": "RES-OT-Spare Parts", "sg": 5470.0, "dist": 2730.0, "tp": 1330.59, "rsp": 1936.06}, {"m": "130-109-821", "d": "CF-Card, ABECO, Windows 7, MQ", "c": "RES-OT-Spare Parts", "sg": 1920.0, "dist": 810.0, "tp": 391.18, "rsp": 679.9}, {"m": "130-095-059", "d": "Cannula Adapter", "c": "RES-OT-Spare Parts", "sg": 1180.0, "dist": 490.0, "tp": 238.5, "rsp": 417.84}, {"m": "130-098-477", "d": "UltraRainbow Calibration Particle Kit", "c": "RES-OT-Spare Parts", "sg": 3200.0, "dist": 1320.0, "tp": 639.99, "rsp": 1130.24}, {"m": "130-093-302", "d": "Fuse 5x20 T4A, set", "c": "RES-OT-Spare Parts", "sg": 90.0, "dist": 40.0, "tp": 14.73, "rsp": 31.61}, {"m": "130-093-384", "d": "Fluid Container Basket, 1.5 L", "c": "RES-OT-Spare Parts", "sg": 1500.0, "dist": 600.0, "tp": 289.23, "rsp": 528.81}, {"m": "130-093-409", "d": "Fuse 2x7mm T2.5", "c": "RES-OT-Spare Parts", "sg": 100.0, "dist": 40.0, "tp": 15.0, "rsp": 34.03}, {"m": "130-109-822", "d": "Bottle Closure 20 L Waste PP, BSS", "c": "RES-OT-Spare Parts", "sg": 3110.0, "dist": 1240.0, "tp": 603.91, "rsp": 1101.16}, {"m": "130-109-817", "d": "Bottle Closure 20 L Buffer PP, BSS", "c": "RES-OT-Spare Parts", "sg": 3120.0, "dist": 1240.0, "tp": 603.6, "rsp": 1102.28}, {"m": "130-093-790", "d": "MultiMACS Column Holder Assembly", "c": "RES-OT-Spare Parts", "sg": 7920.0, "dist": 3140.0, "tp": 1527.82, "rsp": 2803.82}, {"m": "130-093-327", "d": "DC-motor, Y-Axis; MiniSampler", "c": "RES-OT-Spare Parts", "sg": 1330.0, "dist": 530.0, "tp": 256.37, "rsp": 470.94}, {"m": "130-093-256", "d": "MultiMACS Touch Screen Unit", "c": "RES-OT-Spare Parts", "sg": 6000.0, "dist": 2360.0, "tp": 1149.89, "rsp": 2125.24}, {"m": "130-093-781", "d": "MultiMACS Housing", "c": "RES-OT-Spare Parts", "sg": 7030.0, "dist": 2710.0, "tp": 1320.23, "rsp": 2486.8}, {"m": "130-095-050", "d": "CCD Camera", "c": "RES-OT-Spare Parts", "sg": 1280.0, "dist": 490.0, "tp": 235.13, "rsp": 451.21}, {"m": "130-093-789", "d": "MultiMACS Magnet Holder Assembly", "c": "RES-OT-Spare Parts", "sg": 4260.0, "dist": 1630.0, "tp": 791.56, "rsp": 1505.57}, {"m": "130-130-238", "d": "Microscope Z V2", "c": "RES-IM-MACSima-Spare Parts", "sg": 2500.0, "dist": 1180.0, "tp": 571.0, "rsp": 882.86}, {"m": "130-127-722", "d": "Power Supply", "c": "RES-IM-MACSima-Spare Parts", "sg": 6330.0, "dist": 2650.0, "tp": 1289.56, "rsp": 2238.7}, {"m": "130-127-728", "d": "Dual Servo Driver Board Tyto", "c": "RES-IM-MACSima-Spare Parts", "sg": 2010.0, "dist": 810.0, "tp": 390.92, "rsp": 709.25}, {"m": "130-128-507", "d": "Aperture module left", "c": "RES-IM-MACSima-Spare Parts", "sg": 2620.0, "dist": 1030.0, "tp": 500.61, "rsp": 925.7}, {"m": "130-129-160", "d": "Aperture module right", "c": "RES-IM-MACSima-Spare Parts", "sg": 2620.0, "dist": 1030.0, "tp": 500.61, "rsp": 925.7}, {"m": "130-128-506", "d": "3rd Mirror Split. Mod. Right (NKT)", "c": "RES-IM-MACSima-Spare Parts", "sg": 3450.0, "dist": 1360.0, "tp": 659.34, "rsp": 1219.21}, {"m": "130-129-923", "d": "UMII Filter wheel emission for upgrades", "c": "RES-IM-MACSima-Spare Parts", "sg": 8290.0, "dist": 3260.0, "tp": 1587.3, "rsp": 2935.14}, {"m": "130-127-708", "d": "Blindmate 2", "c": "RES-IM-MACSima-Spare Parts", "sg": 2790.0, "dist": 1060.0, "tp": 513.78, "rsp": 985.91}, {"m": "130-127-709", "d": "SmarAct MCS2 Sensor Modul, D-SUB", "c": "RES-IM-MACSima-Spare Parts", "sg": 7310.0, "dist": 2770.0, "tp": 1348.43, "rsp": 2587.53}, {"m": "130-131-059", "d": "Upgrade Kit Microscope V2", "c": "RES-IM-MACSima-Spare Parts", "sg": 3670.0, "dist": 1390.0, "tp": 676.95, "rsp": 1299.0}, {"m": "130-128-473", "d": "Cfast Card 64GB", "c": "RES-IM-MACSima-Spare Parts", "sg": 1390.0, "dist": 520.0, "tp": 250.01, "rsp": 489.35}, {"m": "130-133-194", "d": "Tubing Storage Solution Bottle", "c": "RES-IM-MACSima-Spare Parts", "sg": 1100.0, "dist": 400.0, "tp": 190.25, "rsp": 386.98}, {"m": "130-127-767", "d": "Cable DC Power Jack 80mm", "c": "RES-IM-MACSima-Spare Parts", "sg": 1240.0, "dist": 450.0, "tp": 215.8, "rsp": 438.96}, {"m": "130-127-744", "d": "Cable Interlock PH3 to PH3 0.8m", "c": "RES-IM-MACSima-Spare Parts", "sg": 1160.0, "dist": 420.0, "tp": 201.78, "rsp": 410.43}, {"m": "130-127-769", "d": "Cable MicroFit4 to MicroFit4 4pole 0.8m", "c": "RES-IM-MACSima-Spare Parts", "sg": 1160.0, "dist": 420.0, "tp": 201.11, "rsp": 409.08}, {"m": "200-025-097", "d": "10mm Cap", "c": "CLI-CS-Spare Parts", "sg": 10.0, "dist": 10.0, "tp": 0.15, "rsp": 0.41}, {"m": "200-025-341", "d": "Baghanger O\u00b4Ring", "c": "CLI-CS-Spare Parts", "sg": 20.0, "dist": 10.0, "tp": 2.11, "rsp": 5.77}, {"m": "200-030-062", "d": "Safety Label", "c": "CLI-CS-Spare Parts", "sg": 40.0, "dist": 20.0, "tp": 4.88, "rsp": 12.63}, {"m": "200-075-663", "d": "Stabilisation foot assembly", "c": "CLI-CS-Spare Parts", "sg": 1150.0, "dist": 570.0, "tp": 276.74, "rsp": 404.4}, {"m": "200-075-510", "d": "CliniMACS Fan", "c": "CLI-CS-Spare Parts", "sg": 1120.0, "dist": 530.0, "tp": 255.74, "rsp": 396.7}, {"m": "200-075-514", "d": "CliniMACS Long Hook Baghanger (300 mm)", "c": "CLI-CS-Spare Parts", "sg": 1950.0, "dist": 900.0, "tp": 436.42, "rsp": 687.98}, {"m": "200-075-603", "d": "Buffer Baghanger CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 1990.0, "dist": 900.0, "tp": 438.54, "rsp": 702.9}, {"m": "200-075-178", "d": "CliniMACS Pump Cover", "c": "CLI-CS-Spare Parts", "sg": 2210.0, "dist": 990.0, "tp": 479.22, "rsp": 780.18}, {"m": "200-075-681", "d": "Baghanger redesigned TC ab dual adapter", "c": "CLI-CS-Spare Parts", "sg": 2980.0, "dist": 1310.0, "tp": 635.36, "rsp": 1055.21}, {"m": "200-075-542", "d": "Pump lid CM Prodigy", "c": "CLI-CS-Spare Parts", "sg": 2300.0, "dist": 1010.0, "tp": 488.53, "rsp": 812.79}, {"m": "200-075-515", "d": "CliniMACS Sample Baghanger", "c": "CLI-CS-Spare Parts", "sg": 1570.0, "dist": 690.0, "tp": 335.37, "rsp": 555.84}, {"m": "200-075-631", "d": "IR-Temperature Sensor", "c": "CLI-CS-Spare Parts", "sg": 2890.0, "dist": 1260.0, "tp": 614.13, "rsp": 1021.47}, {"m": "200-075-680", "d": "Baghanger redesigned TC ab", "c": "CLI-CS-Spare Parts", "sg": 2860.0, "dist": 1240.0, "tp": 603.49, "rsp": 1012.61}, {"m": "200-075-100", "d": "CliniMACS Valve Repair Set", "c": "CLI-CS-Spare Parts", "sg": 1430.0, "dist": 620.0, "tp": 301.66, "rsp": 504.25}, {"m": "200-075-530", "d": "CliniMACS Guide Wheel", "c": "CLI-CS-Spare Parts", "sg": 3090.0, "dist": 1320.0, "tp": 642.5, "rsp": 1093.72}, {"m": "130-134-824", "d": "gMOH G2 Front Part Repair Set", "c": "RES-SP-Spare Parts", "sg": 10.0, "dist": 10.0, "tp": 0.44, "rsp": 1.28}, {"m": "130-093-464", "d": "gentleMACS Sleeves", "c": "RES-SP-Spare Parts", "sg": 80.0, "dist": 40.0, "tp": 17.22, "rsp": 27.63}, {"m": "130-120-689", "d": "MACSmix 2.0 PCB", "c": "RES-SP-Spare Parts", "sg": 1720.0, "dist": 660.0, "tp": 317.11, "rsp": 608.17}, {"m": "130-105-228", "d": "gentleMACS Octo Heater", "c": "RES-SP-Spare Parts", "sg": 2300.0, "dist": 830.0, "tp": 400.12, "rsp": 813.86}, {"m": "130-107-539", "d": "gentleMACS Octo C80 Extension Board", "c": "RES-SP-Spare Parts", "sg": 1700.0, "dist": 610.0, "tp": 295.7, "rsp": 601.48}, {"m": "130-128-510", "d": "Reflex-Sensor-Board", "c": "RES-SP-Spare Parts", "sg": 3600.0, "dist": 1290.0, "tp": 625.61, "rsp": 1272.53}, {"m": "130-095-503", "d": "gentleMACS Baseboard", "c": "RES-SP-Spare Parts", "sg": 5080.0, "dist": 1820.0, "tp": 884.45, "rsp": 1799.01}, {"m": "130-134-263", "d": "4-axis BLDC motor controller board", "c": "RES-SP-Spare Parts", "sg": 4330.0, "dist": 1550.0, "tp": 752.69, "rsp": 1531.01}, {"m": "130-106-881", "d": "gentleMACS Octo Heater Board", "c": "RES-SP-Spare Parts", "sg": 3790.0, "dist": 1350.0, "tp": 658.41, "rsp": 1339.26}, {"m": "130-094-439", "d": "gentleMACS/Dispomix BLDC Motor Module", "c": "RES-SP-Spare Parts", "sg": 2290.0, "dist": 800.0, "tp": 388.8, "rsp": 809.59}, {"m": "130-107-675", "d": "gentleMACS Octo Power Supply 24VDC 450W", "c": "RES-SP-Spare Parts", "sg": 1500.0, "dist": 470.0, "tp": 228.29, "rsp": 528.91}, {"m": "130-093-465", "d": "gentleMACS Trough", "c": "RES-SP-Spare Parts", "sg": 150.0, "dist": 50.0, "tp": 20.96, "rsp": 52.44}, {"m": "130-091-044", "d": "MACSmix Rack Left  Bearing Part", "c": "RES-SP-Spare Parts", "sg": 160.0, "dist": 50.0, "tp": 21.5, "rsp": 54.77}, {"m": "130-096-781", "d": "gentleMACS Octo Housing rear part", "c": "RES-SP-Spare Parts", "sg": 910.0, "dist": 280.0, "tp": 135.22, "rsp": 320.4}, {"m": "130-094-422", "d": "gentleMACS/Dispomix Board Spacer Bold", "c": "RES-SP-Spare Parts", "sg": 90.0, "dist": 30.0, "tp": 13.51, "rsp": 29.45}, {"m": "200-075-784", "d": "Air detector", "c": "CLI-PP-Spare Parts", "sg": 3750.0, "dist": 1700.0, "tp": 827.19, "rsp": 1326.51}, {"m": "200-075-786", "d": "Monitor caps, 19.1 mm, white", "c": "CLI-PP-Spare Parts", "sg": 260.0, "dist": 180.0, "tp": 86.43, "rsp": 89.71}, {"m": "200-075-783", "d": "Separator drive", "c": "CLI-PP-Spare Parts", "sg": 5720.0, "dist": 2240.0, "tp": 1090.98, "rsp": 2023.6}, {"m": "200-075-757", "d": "Riser Card", "c": "CLI-PP-Spare Parts", "sg": 1860.0, "dist": 690.0, "tp": 333.19, "rsp": 657.88}, {"m": "200-075-758", "d": "Audio cable Riser Card", "c": "CLI-PP-Spare Parts", "sg": 440.0, "dist": 160.0, "tp": 76.92, "rsp": 155.19}, {"m": "330-001-001", "d": "Pressure Sensor Tube ASI4 (4pc.)", "c": "CLI-PP-Spare Parts", "sg": 1940.0, "dist": 700.0, "tp": 337.68, "rsp": 686.86}, {"m": "200-075-779", "d": "Monitor connector cable", "c": "CLI-PP-Spare Parts", "sg": 1640.0, "dist": 590.0, "tp": 285.07, "rsp": 579.84}, {"m": "330-001-008", "d": "Power connector unit V2.4", "c": "CLI-PP-Spare Parts", "sg": 5080.0, "dist": 1820.0, "tp": 883.1, "rsp": 1796.27}, {"m": "200-075-787", "d": "Accumulator set, 12V, 3.4 Ah (2 pcs.)", "c": "CLI-PP-Spare Parts", "sg": 1340.0, "dist": 480.0, "tp": 232.32, "rsp": 472.56}, {"m": "200-075-776", "d": "Light pressure sensor", "c": "CLI-PP-Spare Parts", "sg": 1480.0, "dist": 530.0, "tp": 256.5, "rsp": 521.74}, {"m": "330-001-007", "d": "Separator drive exchange kit", "c": "CLI-PP-Spare Parts", "sg": 6620.0, "dist": 2370.0, "tp": 1151.48, "rsp": 2342.17}, {"m": "200-075-675", "d": "Pressure sensor PCB ASI v3", "c": "CLI-PP-Spare Parts", "sg": 6730.0, "dist": 2410.0, "tp": 1171.7, "rsp": 2383.29}, {"m": "200-075-756", "d": "PC104 Board", "c": "CLI-PP-Spare Parts", "sg": 8550.0, "dist": 3060.0, "tp": 1488.42, "rsp": 3027.52}, {"m": "200-075-753", "d": "Barcode Scanner, LIFE21", "c": "CLI-PP-Spare Parts", "sg": 5390.0, "dist": 1930.0, "tp": 937.43, "rsp": 1906.79}, {"m": "200-075-785", "d": "Power connection unit", "c": "CLI-PP-Spare Parts", "sg": 3270.0, "dist": 1170.0, "tp": 568.02, "rsp": 1155.39}, {"m": "130-117-136", "d": "Block Connector Liquid Pom 1:4 EVO 100", "c": "RES-CA-Spare Parts", "sg": 3310.0, "dist": 4530.0, "tp": 2205.16, "rsp": 1169.25}, {"m": "130-124-578", "d": "Motor dc multiple use EVO 100", "c": "RES-CA-Spare Parts", "sg": 6830.0, "dist": 8560.0, "tp": 4174.86, "rsp": 2417.87}, {"m": "130-121-526", "d": "Set Spacers For LIHA Freedom EVO 100", "c": "RES-CA-Spare Parts", "sg": 710.0, "dist": 890.0, "tp": 430.31, "rsp": 248.96}, {"m": "130-124-577", "d": "Lock Door Left EVO 100", "c": "RES-CA-Spare Parts", "sg": 7620.0, "dist": 8560.0, "tp": 4174.86, "rsp": 2699.02}, {"m": "130-125-284", "d": "Motor dc arm LIHA Y-Axis EVO 100", "c": "RES-CA-Spare Parts", "sg": 7200.0, "dist": 6880.0, "tp": 3353.01, "rsp": 2550.1}, {"m": "130-121-515", "d": "PCB SMIO / SAFY EVO 100", "c": "RES-CA-Spare Parts", "sg": 5610.0, "dist": 5360.0, "tp": 2610.83, "rsp": 1985.64}, {"m": "130-124-574", "d": "Motor Rotary dc Servo Roma EVO 100", "c": "RES-CA-Spare Parts", "sg": 6380.0, "dist": 6100.0, "tp": 2970.79, "rsp": 2259.4}, {"m": "130-124-575", "d": "Z-Motor Roma EVO 100", "c": "RES-CA-Spare Parts", "sg": 6380.0, "dist": 6100.0, "tp": 2970.79, "rsp": 2259.4}, {"m": "130-117-142", "d": "Pump DMSO Res. with Nozzle EVO 100", "c": "RES-CA-Spare Parts", "sg": 6660.0, "dist": 6360.0, "tp": 3098.86, "rsp": 2356.81}, {"m": "130-119-748", "d": "External Door Lock EVO 100", "c": "RES-CA-Spare Parts", "sg": 6150.0, "dist": 5870.0, "tp": 2863.1, "rsp": 2177.5}, {"m": "130-124-407", "d": "PCBA dc Servo II EVO 100", "c": "RES-CA-Spare Parts", "sg": 7970.0, "dist": 7610.0, "tp": 3711.53, "rsp": 2822.77}, {"m": "130-124-576", "d": "Motor Assy Y-Axis Roma EVO 100", "c": "RES-CA-Spare Parts", "sg": 6560.0, "dist": 6260.0, "tp": 3052.07, "rsp": 2321.22}, {"m": "130-122-982", "d": "PCBA OPTIBO DCU EVO 100", "c": "RES-CA-Spare Parts", "sg": 7290.0, "dist": 6960.0, "tp": 3390.94, "rsp": 2578.95}, {"m": "130-124-572", "d": "Lock Door Right EVO 100", "c": "RES-CA-Spare Parts", "sg": 6320.0, "dist": 6030.0, "tp": 2941.07, "rsp": 2236.8}, {"m": "130-124-573", "d": "Carriage X Axis EVO 100", "c": "RES-CA-Spare Parts", "sg": 6580.0, "dist": 6280.0, "tp": 3061.47, "rsp": 2328.38}, {"m": "200-030-088", "d": "Base label \"Maintenance\"", "c": "CLI-OT-Spare Parts", "sg": 20.0, "dist": 10.0, "tp": 1.41, "rsp": 4.21}, {"m": "200-030-089", "d": "Maintenance Label", "c": "CLI-OT-Spare Parts", "sg": 50.0, "dist": 20.0, "tp": 5.37, "rsp": 15.38}, {"m": "130-120-011", "d": "Ext. Power Switch Mains Evo 100", "c": "RES-CA-Spare Parts", "sg": 7890.0, "dist": 7530.0, "tp": 3672.19, "rsp": 2792.85}, {"m": "220-001-586", "d": "UPS 110V", "c": "CLI-CS-Spare Parts", "sg": 9630.0, "dist": 5790.0, "tp": 2820.88, "rsp": 3409.45}, {"m": "220-001-587", "d": "UPS 230V", "c": "CLI-CS-Spare Parts", "sg": 9430.0, "dist": 5670.0, "tp": 2762.48, "rsp": 3338.86}, {"m": "130-124-374", "d": "Laser fiber 3.5\u00b0", "c": "RES-IM-UM-Spare Parts", "sg": 9150.0, "dist": 5610.0, "tp": 2731.82, "rsp": 3238.33}, {"m": "130-125-129", "d": "Laser fiber 0\u00b0", "c": "RES-IM-UM-Spare Parts", "sg": 9150.0, "dist": 5610.0, "tp": 2731.82, "rsp": 3238.32}, {"m": "130-124-406", "d": "PCBA Backplane LIHA EVO 100", "c": "RES-CA-Spare Parts", "sg": 5810.0, "dist": 5540.0, "tp": 2701.55, "rsp": 2054.64}, {"m": "130-134-264", "d": "FPGA Board assembly", "c": "RES-CA-Spare Parts", "sg": 8820.0, "dist": 5300.0, "tp": 2583.56, "rsp": 3122.62}, {"m": "130-124-570", "d": "Brake Solenoid Z-Axis Roma EVO 100", "c": "RES-CA-Spare Parts", "sg": 5810.0, "dist": 4820.0, "tp": 2347.72, "rsp": 2055.84}, {"m": "130-117-137", "d": "Gripper Finger Roma EVO 100", "c": "RES-CA-Spare Parts", "sg": 5400.0, "dist": 4480.0, "tp": 2181.37, "rsp": 1910.17}, {"m": "130-094-752", "d": "Barcode Reader, Microscan MS4, MQ", "c": "RES-OT-Spare Parts", "sg": 8030.0, "dist": 4160.0, "tp": 2027.54, "rsp": 2840.89}, {"m": "130-124-571", "d": "PCBA Device DCU Board I EVO 100", "c": "RES-CA-Spare Parts", "sg": 4310.0, "dist": 3580.0, "tp": 1743.03, "rsp": 1526.33}, {"m": "130-114-810", "d": "Power Supply Unit", "c": "RES-CA-Spare Parts", "sg": 9710.0, "dist": 3470.0, "tp": 1689.88, "rsp": 3437.32}, {"m": "130-110-226", "d": "Photomultiplier Module, Type -110, Gen.2", "c": "RES-CA-Spare Parts", "sg": 9690.0, "dist": 3460.0, "tp": 1686.07, "rsp": 3429.56}];
const ORDERS_DATA = [{"id": "ORD-1001", "materialNo": "200-075-721", "description": "CMPR Maintenance Kit", "quantity": 10, "listPrice": 152.62, "totalCost": 1526.25, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "LIFE21 Troubleshooting", "arrivalDate": "", "qtyReceived": 2, "backOrder": -8, "engineer": "", "emailFull": "Yes", "emailBack": "NA", "status": "Back Order", "month": "March 2025", "year": "2025"}, {"id": "ORD-1002", "materialNo": "130-097-866", "description": "Pump Syringe, Hamilton, 5ml, PSD4, v3", "quantity": 10, "listPrice": 210.64, "totalCost": 2106.41, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "LIFE21 Troubleshooting", "arrivalDate": "", "qtyReceived": 2, "backOrder": -8, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "March 2025", "year": "2025"}, {"id": "ORD-1003", "materialNo": "130-090-385", "description": "Hydrophobic air filter", "quantity": 50, "listPrice": 18.02, "totalCost": 900.95, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "MQ IQOQ item", "arrivalDate": "", "qtyReceived": 1, "backOrder": -49, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "March 2025", "year": "2025"}, {"id": "ORD-1004", "materialNo": "130-093-365", "description": "Peristaltic Pump Head incl. Tube", "quantity": 15, "listPrice": 91.7, "totalCost": 1375.57, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "MQ IQOQ and Service use", "arrivalDate": "", "qtyReceived": 1, "backOrder": -14, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "March 2025", "year": "2025"}, {"id": "ORD-1005", "materialNo": "130-127-593", "description": "Rear Fan Air Filter, MACSima", "quantity": 10, "listPrice": 130.83, "totalCost": 1308.32, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "", "qtyReceived": 0, "backOrder": -10, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "March 2025", "year": "2025"}, {"id": "ORD-1006", "materialNo": "130-130-240", "description": "Spring Return For Door", "quantity": 10, "listPrice": 313.45, "totalCost": 3134.46, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "", "qtyReceived": 0, "backOrder": -10, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "March 2025", "year": "2025"}, {"id": "ORD-1007", "materialNo": "130-132-390", "description": "MACSima\u00a0BioQC\u00a0Sample", "quantity": 4, "listPrice": 180.38, "totalCost": 721.52, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "LIFE21 Troubleshooting", "arrivalDate": "", "qtyReceived": 4, "backOrder": 0, "engineer": "", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "April 2025", "year": "2025"}, {"id": "ORD-1008", "materialNo": "130-132-391", "description": "MACSima\u00a0BioQC\u00a0Reagent Plate", "quantity": 4, "listPrice": 100.0, "totalCost": 400.0, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "LIFE21 Troubleshooting", "arrivalDate": "", "qtyReceived": 4, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "April 2025", "year": "2025"}, {"id": "ORD-1009", "materialNo": "130-127-575", "description": "MACSima Stain Support Kit", "quantity": 4, "listPrice": 121.73, "totalCost": 486.92, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "MQ IQOQ item", "arrivalDate": "", "qtyReceived": 4, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "April 2025", "year": "2025"}, {"id": "ORD-1010", "materialNo": "130-135-064", "description": "Cable\u00a0USB\u00a03.0 MicroB-A 2m", "quantity": 2, "listPrice": 0, "totalCost": 0, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "MQ IQOQ and Service use", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "April 2025", "year": "2025"}, {"id": "ORD-1011", "materialNo": "200-075-721", "description": "CMPR Maintenance Kit", "quantity": 5, "listPrice": 152.62, "totalCost": 763.12, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 5, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "June 2025", "year": "2025"}, {"id": "ORD-1012", "materialNo": "130-127-575", "description": "MACSima Stain Support Kit, mouse", "quantity": 3, "listPrice": 121.73, "totalCost": 365.19, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 3, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "June 2025", "year": "2025"}, {"id": "ORD-1013", "materialNo": "130-132-391", "description": "MACSima BioQC Reagent Plate", "quantity": 3, "listPrice": 100.0, "totalCost": 300.0, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 3, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "June 2025", "year": "2025"}, {"id": "ORD-1014", "materialNo": "130-132-390", "description": "MACSima BioQC Sample", "quantity": 3, "listPrice": 180.38, "totalCost": 541.14, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 3, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "June 2025", "year": "2025"}, {"id": "ORD-1015", "materialNo": "130-094-683", "description": "Sheath Particle Filter, PALL Ultipor N66", "quantity": 10, "listPrice": 258.17, "totalCost": 2581.68, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "June 2025", "year": "2025"}, {"id": "ORD-1016", "materialNo": "130-132-330", "description": "CFast 2.0 Card 128GB", "quantity": 5, "listPrice": 345.03, "totalCost": 1725.13, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 4, "backOrder": -1, "engineer": "Fu Siong", "emailFull": "NA", "emailBack": "Yes", "status": "Back Order", "month": "June 2025", "year": "2025"}, {"id": "ORD-1017", "materialNo": "200-075-780", "description": "Silicone gasket bottom housing", "quantity": 5, "listPrice": 95.48, "totalCost": 477.39, "orderDate": "2025-06-20", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 5, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "June 2025", "year": "2025"}, {"id": "ORD-1018", "materialNo": "130-132-970", "description": "Yearly Maintenance Kit, MACSima", "quantity": 5, "listPrice": 2853.51, "totalCost": 14267.57, "orderDate": "2025-07-10", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 0, "backOrder": -5, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "Yes", "status": "Back Order", "month": "July 2025", "year": "2025"}, {"id": "ORD-1019", "materialNo": "130-114-813", "description": "Horizontal mirror adjuster", "quantity": 3, "listPrice": 1104.88, "totalCost": 3314.63, "orderDate": "2025-07-10", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 3, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "July 2025", "year": "2025"}, {"id": "ORD-1020", "materialNo": "130-128-514", "description": "Tyto BioQC cell sample", "quantity": 2, "listPrice": 56.76, "totalCost": 113.52, "orderDate": "2025-07-10", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 2, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "July 2025", "year": "2025"}, {"id": "ORD-1021", "materialNo": "130-127-414", "description": "IQ/OQ Fixed WBC, CD45VB, 1x10e7/ml, 13ml", "quantity": 1, "listPrice": 135.79, "totalCost": 135.79, "orderDate": "", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "2_July 2025", "year": "2025"}, {"id": "ORD-1022", "materialNo": "130-127-427", "description": "IQ/OQ Fixed WBC, 1x10e7/ml, 7ml", "quantity": 1, "listPrice": 41.75, "totalCost": 41.75, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "2_July 2025", "year": "2025"}, {"id": "ORD-1023", "materialNo": "", "description": "BD trucount", "quantity": 1, "listPrice": 0, "totalCost": 0, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "2025-07-29", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "NA", "emailBack": "NA", "status": "Received", "month": "2_July 2025", "year": "2025"}, {"id": "ORD-1024", "materialNo": "130-115-120", "description": "Bio tubing, OD=6,4mm, 250mm", "quantity": 5, "listPrice": 28.56, "totalCost": 142.82, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "2025-07-28", "qtyReceived": 3, "backOrder": -2, "engineer": "Fu Siong", "emailFull": "NA", "emailBack": "Yes", "status": "Back Order", "month": "2_July 2025", "year": "2025"}, {"id": "ORD-1025", "materialNo": "200-075-768", "description": "Door contacts micro switch", "quantity": 2, "listPrice": 196.06, "totalCost": 392.13, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "LIFE21 Troubleshooting", "arrivalDate": "2025-07-28", "qtyReceived": 2, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "3_July 2025", "year": "2025"}, {"id": "ORD-1026", "materialNo": "200-075-775", "description": "Reed switch", "quantity": 2, "listPrice": 120.03, "totalCost": 240.06, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "LIFE21 Troubleshooting", "arrivalDate": "2025-07-28", "qtyReceived": 2, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "3_July 2025", "year": "2025"}, {"id": "ORD-1027", "materialNo": "130-094-458", "description": "MACSQuant Column", "quantity": 1, "listPrice": 0, "totalCost": 0, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "MQ IQOQ item", "arrivalDate": "2025-07-28", "qtyReceived": 1, "backOrder": 0, "engineer": "Wee Boon", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "3_July 2025", "year": "2025"}, {"id": "ORD-1028", "materialNo": "130-093-607", "description": "MACSQuant Calibration Beads", "quantity": 1, "listPrice": 0, "totalCost": 0, "orderDate": "2025-07-15", "orderBy": "Fu Siong", "remark": "MQ IQOQ and Service use", "arrivalDate": "2025-07-28", "qtyReceived": 1, "backOrder": 0, "engineer": "Wee Boon", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "3_July 2025", "year": "2025"}, {"id": "ORD-1029", "materialNo": "200-075-646", "description": "Microscope Camera Board II", "quantity": 1, "listPrice": 2521.72, "totalCost": 2521.72, "orderDate": "2025-07-23", "orderBy": "Fu Siong", "remark": "ACTRIS 1725", "arrivalDate": "2025-07-28", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "4_July 2025", "year": "2025"}, {"id": "ORD-1030", "materialNo": "200-075-553", "description": "Focus Servo CM Prodigy", "quantity": 1, "listPrice": 296.67, "totalCost": 296.67, "orderDate": "2025-07-23", "orderBy": "Fu Siong", "remark": "ACTRIS 1725", "arrivalDate": "2025-07-28", "qtyReceived": 1, "backOrder": 0, "engineer": "Wee Boon", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "4_July 2025", "year": "2025"}, {"id": "ORD-1031", "materialNo": "200-075-552", "description": "Motion Controller CM Prodigy", "quantity": 1, "listPrice": 1117.4, "totalCost": 1117.4, "orderDate": "2025-07-23", "orderBy": "Fu Siong", "remark": "ACTRIS 1725", "arrivalDate": "2025-07-28", "qtyReceived": 1, "backOrder": 0, "engineer": "Wee Boon", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "4_July 2025", "year": "2025"}, {"id": "ORD-1032", "materialNo": "200-075-554", "description": "Chamber Drive Servo Motor CM Prodigy", "quantity": 1, "listPrice": 1233.97, "totalCost": 1233.97, "orderDate": "2025-07-23", "orderBy": "Fu Siong", "remark": "ACTRIS 1725", "arrivalDate": "2025-07-28", "qtyReceived": 1, "backOrder": 0, "engineer": "Wee Boon", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "4_July 2025", "year": "2025"}, {"id": "ORD-1033", "materialNo": "320-003-125", "description": "T Cam Pro Set", "quantity": 3, "listPrice": 134.64, "totalCost": 403.92, "orderDate": "2025-09-18", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 0, "backOrder": -3, "engineer": "", "emailFull": "Yes", "emailBack": "NA", "status": "Back Order", "month": "2_Sep 2025", "year": "2025"}, {"id": "ORD-1034", "materialNo": "130-097-851", "description": "Dilutor Valve, 6-port distribution, v3", "quantity": 10, "listPrice": 991.45, "totalCost": 9914.52, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1035", "materialNo": "130-122-182", "description": "6-Port Distribution Valve, MQ", "quantity": 15, "listPrice": 740.81, "totalCost": 11112.21, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 15, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1036", "materialNo": "130-093-371", "description": "4-port 3-way Valve", "quantity": 10, "listPrice": 300.38, "totalCost": 3003.85, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1037", "materialNo": "130-090-684", "description": "4-port 4-way valve", "quantity": 15, "listPrice": 270.58, "totalCost": 4058.72, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 15, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1038", "materialNo": "130-115-131", "description": "Needle Arm Mixing Gasket", "quantity": 5, "listPrice": 409.41, "totalCost": 2047.03, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 5, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1039", "materialNo": "130-118-210", "description": "Peristaltic Pump Head, white", "quantity": 10, "listPrice": 40.64, "totalCost": 406.44, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1040", "materialNo": "130-127-575", "description": "MACSima Stain Support Kit, mouse", "quantity": 3, "listPrice": 180.38, "totalCost": 541.14, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 0, "backOrder": -3, "engineer": "", "emailFull": "Yes", "emailBack": "", "status": "Back Order", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1041", "materialNo": "130-132-391", "description": "MACSima BioQC Reagent Plate", "quantity": 3, "listPrice": 100.0, "totalCost": 300.0, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 0, "backOrder": -3, "engineer": "", "emailFull": "Yes", "emailBack": "", "status": "Back Order", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1042", "materialNo": "130-132-390", "description": "MACSima BioQC Sample", "quantity": 3, "listPrice": 121.73, "totalCost": 365.19, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 0, "backOrder": -3, "engineer": "", "emailFull": "Yes", "emailBack": "", "status": "Back Order", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1043", "materialNo": "200-075-723", "description": "Hood Light Protection Cover", "quantity": 5, "listPrice": 29.19, "totalCost": 145.97, "orderDate": "2025-09-04", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "2025-09-23", "qtyReceived": 5, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "", "status": "Received", "month": "Sep 2025", "year": "2025"}, {"id": "ORD-1044", "materialNo": "130-090-685", "description": "4-port distribution valve", "quantity": 20, "listPrice": 298.74, "totalCost": 5974.76, "orderDate": "", "orderBy": "Wee Boon", "remark": "Bring forward to Nov", "arrivalDate": "", "qtyReceived": 0, "backOrder": -20, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "Oct 2025", "year": "2025"}, {"id": "ORD-1045", "materialNo": "130-094-729", "description": "Dilutor Valve, 6-port distribution, v2", "quantity": 5, "listPrice": 412.92, "totalCost": 2064.6, "orderDate": "", "orderBy": "Wee Boon", "remark": "Bring forward to Nov", "arrivalDate": "", "qtyReceived": 0, "backOrder": -5, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "Oct 2025", "year": "2025"}, {"id": "ORD-1046", "materialNo": "130-139-079", "description": "CFast-Card MQ Tyto MBCore/V3.2", "quantity": 1, "listPrice": 200.0, "totalCost": 200.0, "orderDate": "", "orderBy": "Wee Boon", "remark": "Bring forward to Nov", "arrivalDate": "", "qtyReceived": 0, "backOrder": -1, "engineer": "", "emailFull": "", "emailBack": "", "status": "Back Order", "month": "Oct 2025", "year": "2025"}, {"id": "ORD-1047", "materialNo": "130-118-210", "description": "Peristaltic Pump Head, white", "quantity": 8, "listPrice": 40.64, "totalCost": 325.16, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 8, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1048", "materialNo": "130-115-131", "description": "Needle Arm Mixing Gasket", "quantity": 2, "listPrice": 409.41, "totalCost": 818.81, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1049", "materialNo": "130-115-122", "description": "Peristaltic Pump sample Tube", "quantity": 2, "listPrice": 57.83, "totalCost": 115.66, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1050", "materialNo": "130-115-124", "description": "Sheath Particle Filter, small", "quantity": 4, "listPrice": 216.19, "totalCost": 864.76, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 4, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1051", "materialNo": "130-097-866", "description": "Pump Syringe, Hamilton, 5ml, PSD4, v3", "quantity": 10, "listPrice": 210.64, "totalCost": 2106.41, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1052", "materialNo": "130-097-867", "description": "Pump Syringe, Hamilton, 0.5ml, PSD4, v3", "quantity": 10, "listPrice": 157.53, "totalCost": 1575.28, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1053", "materialNo": "130-094-683", "description": "Sheath Particle Filter, PALL Ultipor N66", "quantity": 5, "listPrice": 258.17, "totalCost": 1290.84, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 5, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1054", "materialNo": "130-093-365", "description": "Peristaltic Pump Head incl. Tube", "quantity": 20, "listPrice": 91.7, "totalCost": 1834.09, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 20, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1055", "materialNo": "130-090-385", "description": "Hydrophobic air filter", "quantity": 50, "listPrice": 18.02, "totalCost": 900.95, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 50, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1056", "materialNo": "130-090-685", "description": "4-port distribution valve", "quantity": 20, "listPrice": 298.74, "totalCost": 5974.76, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 20, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1057", "materialNo": "130-094-729", "description": "Dilutor Valve, 6-port distribution, v2", "quantity": 5, "listPrice": 412.92, "totalCost": 2064.6, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 5, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1058", "materialNo": "130-139-079", "description": "CFast-Card MQ Tyto MBCore/V3.2", "quantity": 1, "listPrice": 200.0, "totalCost": 200.0, "orderDate": "2025-11-04", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "", "qtyReceived": 1, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1059", "materialNo": "200-075-672", "description": "Pump controller PCB VIMOT v3", "quantity": 1, "listPrice": 499.69, "totalCost": 499.69, "orderDate": "2025-11-10", "orderBy": "Fu Siong", "remark": "Life21 SGH", "arrivalDate": "", "qtyReceived": 1, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1060", "materialNo": "200-075-769", "description": "Excenter drive", "quantity": 1, "listPrice": 1619.45, "totalCost": 1619.45, "orderDate": "2025-11-10", "orderBy": "Fu Siong", "remark": "Life21 SGH", "arrivalDate": "", "qtyReceived": 1, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1061", "materialNo": "130-127-414", "description": "IQ/OQ Fixed WBC, CD45VB, 1x10e7/ml, 13ml", "quantity": 2, "listPrice": 135.79, "totalCost": 271.58, "orderDate": "2025-11-18", "orderBy": "Fu Siong", "remark": "KKH MQ10 IQOQ", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1062", "materialNo": "", "description": "BD Trucount", "quantity": 1, "listPrice": 0, "totalCost": 0, "orderDate": "2025-11-18", "orderBy": "Fu Siong", "remark": "KKH MQ10 IQOQ", "arrivalDate": "", "qtyReceived": 1, "backOrder": 0, "engineer": "", "emailFull": "", "emailBack": "", "status": "Received", "month": "Nov 2025", "year": "2025"}, {"id": "ORD-1063", "materialNo": "130-093-607", "description": "MACSQuant Calibration Beads", "quantity": 2, "listPrice": 80.0, "totalCost": 160.0, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1064", "materialNo": "200-076-612", "description": "Prodigy supplementary bag", "quantity": 3, "listPrice": 140.0, "totalCost": 420.0, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 3, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1065", "materialNo": "200-075-560", "description": "Ventilation Unit, TCU CM Prodigy", "quantity": 1, "listPrice": 4135.51, "totalCost": 4135.51, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1066", "materialNo": "130-093-365", "description": "Peristaltic Pump Head incl. Tube", "quantity": 20, "listPrice": 91.7, "totalCost": 1834.09, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 20, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1067", "materialNo": "130-118-210", "description": "Peristaltic Pump Head, white", "quantity": 20, "listPrice": 40.64, "totalCost": 812.89, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 20, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1068", "materialNo": "130-115-131", "description": "Needle Arm Mixing Gasket", "quantity": 10, "listPrice": 409.41, "totalCost": 4094.05, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1069", "materialNo": "130-093-371", "description": "4-port 3-way Valve", "quantity": 10, "listPrice": 300.38, "totalCost": 3003.85, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1070", "materialNo": "200-075-723", "description": "Hood Light Protection Cover", "quantity": 5, "listPrice": 29.19, "totalCost": 145.97, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 5, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1071", "materialNo": "130-094-683", "description": "Sheath Particle Filter, PALL Ultipor N66", "quantity": 10, "listPrice": 258.17, "totalCost": 2581.68, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1072", "materialNo": "130-097-866", "description": "Pump Syringe, Hamilton, 5ml, PSD4, v3", "quantity": 10, "listPrice": 210.64, "totalCost": 2106.41, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1073", "materialNo": "130-097-867", "description": "Pump Syringe, Hamilton, 0.5ml, PSD4, v3", "quantity": 10, "listPrice": 157.53, "totalCost": 1575.28, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2025"}, {"id": "ORD-1074", "materialNo": "130-127-414", "description": "IQ/OQ Fixed WBC, CD45VB, 1x10e7/ml, 13ml", "quantity": 1, "listPrice": 135.79, "totalCost": 135.79, "orderDate": "", "orderBy": "Fu Siong", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "2_July 2025", "year": "2026"}, {"id": "ORD-1075", "materialNo": "130-127-427", "description": "IQ/OQ Fixed WBC, 1x10e7/ml, 7ml", "quantity": 1, "listPrice": 41.75, "totalCost": 41.75, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "2025-07-23", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "2_July 2025", "year": "2026"}, {"id": "ORD-1076", "materialNo": "", "description": "BD trucount", "quantity": 1, "listPrice": 0, "totalCost": 0, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "2025-07-29", "qtyReceived": 0, "backOrder": -1, "engineer": "Fu Siong", "emailFull": "NA", "emailBack": "NA", "status": "Back Order", "month": "2_July 2025", "year": "2026"}, {"id": "ORD-1077", "materialNo": "130-115-120", "description": "Bio tubing, OD=6,4mm, 250mm", "quantity": 5, "listPrice": 28.56, "totalCost": 142.82, "orderDate": "", "orderBy": "", "remark": "", "arrivalDate": "2025-07-28", "qtyReceived": 3, "backOrder": -2, "engineer": "Fu Siong", "emailFull": "NA", "emailBack": "Yes", "status": "Back Order", "month": "2_July 2025", "year": "2026"}, {"id": "ORD-1078", "materialNo": "130-093-607", "description": "MACSQuant Calibration Beads", "quantity": 2, "listPrice": 80.0, "totalCost": 160.0, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "Wee Boon", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1079", "materialNo": "200-076-612", "description": "Prodigy supplementary bag", "quantity": 3, "listPrice": 140.0, "totalCost": 420.0, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 3, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1080", "materialNo": "200-075-560", "description": "Ventilation Unit, TCU CM Prodigy", "quantity": 1, "listPrice": 4135.51, "totalCost": 4135.51, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 1, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1081", "materialNo": "130-093-365", "description": "Peristaltic Pump Head incl. Tube", "quantity": 20, "listPrice": 91.7, "totalCost": 1834.09, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 20, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1082", "materialNo": "130-118-210", "description": "Peristaltic Pump Head, white", "quantity": 20, "listPrice": 40.64, "totalCost": 812.89, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 20, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1083", "materialNo": "130-115-131", "description": "Needle Arm Mixing Gasket", "quantity": 10, "listPrice": 409.41, "totalCost": 4094.05, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1084", "materialNo": "130-093-371", "description": "4-port 3-way Valve", "quantity": 10, "listPrice": 300.38, "totalCost": 3003.85, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1085", "materialNo": "200-075-723", "description": "Hood Light Protection Cover", "quantity": 5, "listPrice": 29.19, "totalCost": 145.97, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 5, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1086", "materialNo": "130-094-683", "description": "Sheath Particle Filter, PALL Ultipor N66", "quantity": 10, "listPrice": 258.17, "totalCost": 2581.68, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1087", "materialNo": "130-097-866", "description": "Pump Syringe, Hamilton, 5ml, PSD4, v3", "quantity": 10, "listPrice": 210.64, "totalCost": 2106.41, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1088", "materialNo": "130-097-867", "description": "Pump Syringe, Hamilton, 0.5ml, PSD4, v3", "quantity": 10, "listPrice": 157.53, "totalCost": 1575.28, "orderDate": "2025-12-15", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 10, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "1_Dec_2025", "year": "2026"}, {"id": "ORD-1089", "materialNo": "130-127-414", "description": "IQ/OQ Fixed WBC, CD45VB, 1x10e7/ml, 13ml", "quantity": 2, "listPrice": 80.0, "totalCost": 160.0, "orderDate": "2026-01-02", "orderBy": "Fu Siong", "remark": "processed", "arrivalDate": "", "qtyReceived": 2, "backOrder": 0, "engineer": "Fu Siong", "emailFull": "Yes", "emailBack": "NA", "status": "Received", "month": "Jan_2026", "year": "2026"}];
const PRICE_CONFIG_DEFAULT = { exchangeRate: 1.85, sgMarkup: 1.4, gst: 1.09, distMarkup: 2.05, specialRate: 2.0, year: 2025 };

const CATEGORIES = {
  'CLI-CS-Spare Parts': { label: 'Clinical Cell Sorting', short: 'CLI-CS', color: '#0B7A3E' },
  'CLI-OT-Spare Parts': { label: 'Clinical Other', short: 'CLI-OT', color: '#047857' },
  'CLI-PP-Spare Parts': { label: 'Clinical Pre-Processing', short: 'CLI-PP', color: '#059669' },
  'RES-CA-Spare Parts': { label: 'Research Cell Analysis', short: 'RES-CA', color: '#2563EB' },
  'RES-CS-Spare Parts': { label: 'Research Cell Sorting', short: 'RES-CS', color: '#1D4ED8' },
  'RES-IM-MACSima-Spare Parts': { label: 'MACSima Imaging', short: 'MACSima', color: '#7C3AED' },
  'RES-IM-Spare Parts': { label: 'Research Imaging', short: 'RES-IM', color: '#9333EA' },
  'RES-IM-UM-Spare Parts': { label: 'UltraMicroscope', short: 'UM', color: '#A855F7' },
  'RES-OT-Spare Parts': { label: 'Research Other', short: 'RES-OT', color: '#D97706' },
  'RES-SP-Spare Parts': { label: 'Research Sample Prep', short: 'RES-SP', color: '#EA580C' },
};

const DEFAULT_USERS = [
  { id: 'U001', username: 'admin', password: 'admin123', name: 'System Admin', email: 'admin@miltenyibiotec.com', role: 'admin', status: 'active', created: '2025-01-01', phone: '+65 6221 0001' },
  { id: 'U002', username: 'fusiong', password: 'fs2025', name: 'Fu Siong', email: 'fusiong@miltenyibiotec.com', role: 'user', status: 'active', created: '2025-01-15', phone: '+65 9111 2222' },
  { id: 'U003', username: 'weeboon', password: 'wb2025', name: 'Wee Boon', email: 'weeboon@miltenyibiotec.com', role: 'user', status: 'active', created: '2025-02-01', phone: '+65 9333 4444' },
];

const MONTH_OPTIONS = [
  'Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026',
  'Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026'
];

// ════════════════════════════ HELPERS ═════════════════════════════════
const fmt = (n) => n != null && n !== 0 ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', minimumFractionDigits: 2 }).format(n) : '\u2014';
const fmtDate = (d) => d && d !== 'None' ? new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';
const fmtNum = (n) => new Intl.NumberFormat('en-SG').format(n);

const STATUS_CFG = {
  Received: { color: '#0B7A3E', bg: '#E6F4ED', icon: CheckCircle },
  'Back Order': { color: '#C53030', bg: '#FEE2E2', icon: AlertTriangle },
  Processed: { color: '#2563EB', bg: '#DBEAFE', icon: Clock },
  Pending: { color: '#D97706', bg: '#FEF3C7', icon: AlertCircle },
  'Pending Approval': { color: '#7C3AED', bg: '#EDE9FE', icon: Clock },
  Approved: { color: '#0B7A3E', bg: '#D1FAE5', icon: CheckCircle },
  Rejected: { color: '#DC2626', bg: '#FEE2E2', icon: X },
};
const Badge = ({ status }) => { const c = STATUS_CFG[status]||STATUS_CFG.Pending; const I=c.icon; return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,color:c.color,background:c.bg }}><I size={12}/> {status}</span>; };
const Pill = ({ bg, color, children }) => <span className="pill" style={{ background: bg, color }}>{children}</span>;
const Toggle = ({ active, onClick, color }) => <div onClick={onClick} style={{ width:40,height:22,borderRadius:11,background:active?(color||'#0B7A3E'):'#E2E8F0',cursor:'pointer',position:'relative',transition:'background 0.2s' }}><div style={{ width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:active?20:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}/></div>;
const Toast = ({ items, onDismiss }) => <div style={{ position:'fixed',top:80,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:380 }}>{items.map((n,i) => <div key={i} style={{ background:n.type==='success'?'#0B7A3E':n.type==='warning'?'#D97706':'#2563EB',color:'#fff',padding:'12px 16px',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.18)',display:'flex',alignItems:'center',gap:10,animation:'slideIn 0.3s' }}>{n.type==='success'?<CheckCircle size={18}/>:n.type==='warning'?<AlertTriangle size={18}/>:<Bell size={18}/>}<div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:11,opacity:0.9}}>{n.message}</div></div><button onClick={()=>onDismiss(i)} style={{background:'none',border:'none',color:'#fff',cursor:'pointer'}}><X size={14}/></button></div>)}</div>;

// ════════════════════════════ QR CODE GENERATOR ══════════════════════
// Simple QR-like pattern generator for WhatsApp Baileys simulation
const QRCodeCanvas = ({ text, size = 200 }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const modules = 25;
    const cellSize = size / modules;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    // Generate deterministic pattern from text
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = ((seed << 5) - seed) + text.charCodeAt(i);
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    // Draw finder patterns
    const drawFinder = (x, y) => {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        if (i===0||i===6||j===0||j===6||(i>=2&&i<=4&&j>=2&&j<=4)) ctx.fillRect((x+j)*cellSize, (y+i)*cellSize, cellSize, cellSize);
      }
    };
    drawFinder(0, 0); drawFinder(modules-7, 0); drawFinder(0, modules-7);
    // Fill data area
    for (let i = 0; i < modules; i++) for (let j = 0; j < modules; j++) {
      if ((i<7&&j<7)||(i<7&&j>=modules-7)||(i>=modules-7&&j<7)) continue;
      if (rng() > 0.5) ctx.fillRect(j*cellSize, i*cellSize, cellSize, cellSize);
    }
  }, [text, size]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8, border: '4px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />;
};

// ════════════════════════════ MAIN APP ════════════════════════════════
export default function App() {
  // ── Check if opened as Order Detail Window ──
  const urlParams = new URLSearchParams(window.location.search);
  const isOrderDetailWindow = urlParams.get('orderDetail') === 'true';
  const [orderDetailData, setOrderDetailData] = useState(() => {
    if (isOrderDetailWindow) {
      const stored = localStorage.getItem('viewOrderDetail');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  // ── Auth State ──
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // login | register
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', password: '', name: '', email: '', phone: '' });
  const [pendingUsers, setPendingUsers] = useState([
    { id: 'P001', username: 'liwei', name: 'Li Wei', email: 'liwei@miltenyibiotec.com', phone: '+65 9555 6666', requestDate: '2026-02-03' },
  ]);

  // ── App State ──
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [notifs, setNotifs] = useState([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBulkGroup, setSelectedBulkGroup] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [historyImportData, setHistoryImportData] = useState([]);
  const [historyImportPreview, setHistoryImportPreview] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState({ key: 'sg', dir: 'desc' });
  const [priceConfig, setPriceConfig] = useState(PRICE_CONFIG_DEFAULT);
  const [catalogPage, setCatalogPage] = useState(0);

  // ── WhatsApp Baileys State ──
  const [waConnected, setWaConnected] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waQrVisible, setWaQrVisible] = useState(false);
  const [waQrCode, setWaQrCode] = useState('');
  const [waSessionInfo, setWaSessionInfo] = useState(null);
  const [waMessages, setWaMessages] = useState([
    { id: 'WA-001', to: '+65 9111 2222 (Fu Siong)', message: 'Back Order Alert: Yearly Maintenance Kit, MACSima — 5 units pending', time: '2025-12-18 09:30', status: 'delivered' },
    { id: 'WA-002', to: '+65 9333 4444 (Wee Boon)', message: 'Stock Level Alert: Low inventory on pump syringes', time: '2026-01-05 14:15', status: 'delivered' },
    { id: 'WA-003', to: 'SG Service Team Group', message: 'Delivery arrived: Sep 2025 batch — 5 items to verify', time: '2025-09-24 10:00', status: 'read' },
  ]);
  const [waRecipient, setWaRecipient] = useState('');
  const [waMessageText, setWaMessageText] = useState('');
  const [waTemplate, setWaTemplate] = useState('custom');

  // ── Bulk Order State ──
  const [showBulkOrder, setShowBulkOrder] = useState(false);
  const [bulkMonth, setBulkMonth] = useState('Feb 2026');
  const [bulkItems, setBulkItems] = useState([{ materialNo: '', description: '', quantity: 1, listPrice: 0 }]);
  const [bulkOrderBy, setBulkOrderBy] = useState('Fu Siong');
  const [bulkRemark, setBulkRemark] = useState('');
  const [bulkGroups, setBulkGroups] = useState([]);// Cleared for history import

  // ── Stock Check & Notif Log ──
  const [stockChecks, setStockChecks] = useState([
    { id: 'SC-001', date: '2025-12-20', checkedBy: 'Fu Siong', items: 42, disc: 2, status: 'Completed', notes: 'Minor count discrepancy on pump heads' },
    { id: 'SC-002', date: '2026-01-10', checkedBy: 'Wee Boon', items: 38, disc: 0, status: 'Completed', notes: 'All items verified' },
    { id: 'SC-003', date: '2026-01-25', checkedBy: 'Fu Siong', items: 45, disc: 1, status: 'In Progress', notes: 'Pending valve count recheck' },
  ]);

  // ── Part Arrival Check State ──
  const [arrivalCheckMode, setArrivalCheckMode] = useState(false);
  const [selectedBulkForArrival, setSelectedBulkForArrival] = useState(null);
  const [arrivalItems, setArrivalItems] = useState([]);

  // ── Enhanced Stock Check State ──
  const [stockCheckMode, setStockCheckMode] = useState(false);
  const [stockInventoryList, setStockInventoryList] = useState([]);
  const [selectedStockCheck, setSelectedStockCheck] = useState(null);

  const [notifLog, setNotifLog] = useState([
    { id: 'N-001', type: 'email', to: 'service-sg@miltenyibiotec.com', subject: 'Monthly Update - Dec 2025', date: '2025-12-20', status: 'Sent' },
    { id: 'N-002', type: 'whatsapp', to: '+65 9111 2222', subject: 'Back Order: Maintenance Kit', date: '2025-12-18', status: 'Delivered' },
    { id: 'N-003', type: 'email', to: 'warehouse@miltenyibiotec.com', subject: 'Delivery Confirmation Sep 2025', date: '2025-09-24', status: 'Sent' },
  ]);

  const notify = useCallback((title, message, type = 'info') => {
    setNotifs(prev => [...prev, { title, message, type }]);
    setTimeout(() => setNotifs(prev => prev.slice(1)), 4000);
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // ── Catalog ──
  const catalogLookup = useMemo(() => { const m={}; PARTS_CATALOG.forEach(p=>{m[p.m]=p;}); return m; }, []);
  const PAGE_SIZE = 25;
  const catalog = useMemo(() => {
    let items = PARTS_CATALOG.map(p => ({ materialNo:p.m, description:p.d, category:p.c, singaporePrice:p.sg, distributorPrice:p.dist, transferPrice:p.tp, rspEur:p.rsp }));
    if (catalogSearch) { const q=catalogSearch.toLowerCase(); items=items.filter(p=>p.materialNo.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)); }
    if (catFilter !== 'All') items=items.filter(p=>p.category===catFilter);
    const key = catalogSort.key==='sg'?'singaporePrice':catalogSort.key==='dist'?'distributorPrice':catalogSort.key==='tp'?'transferPrice':'description';
    items.sort((a,b) => { const va=a[key],vb=b[key]; return catalogSort.dir==='asc'?(va>vb?1:-1):(va<vb?1:-1); });
    return items;
  }, [catalogSearch, catFilter, catalogSort]);

  // ── Stats ──
  const stats = useMemo(() => {
    const t=orders.length, r=orders.filter(o=>o.status==='Received').length, b=orders.filter(o=>o.status==='Back Order').length;
    const p=orders.filter(o=>o.status==='Pending'||o.status==='Processed').length;
    const tc=orders.reduce((s,o)=>s+o.totalCost,0), tq=orders.reduce((s,o)=>s+o.quantity,0), tr=orders.reduce((s,o)=>s+o.qtyReceived,0);
    return { total:t, received:r, backOrder:b, pending:p, totalCost:tc, fulfillmentRate: tq>0?((tr/tq)*100).toFixed(1):0 };
  }, [orders]);
  const filteredOrders = useMemo(() => orders.filter(o => {
    const ms = !search || o.materialNo.toLowerCase().includes(search.toLowerCase()) || o.description.toLowerCase().includes(search.toLowerCase()) || o.orderBy.toLowerCase().includes(search.toLowerCase());
    return ms && (statusFilter==='All'||o.status===statusFilter);
  }), [orders, search, statusFilter]);
  const monthlyData = useMemo(() => {
    const months=['Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan'];
    const mm={'Feb 2025':0,'March 2025':1,'April 2025':2,'May 2025':3,'June 2025':4,'July 2025':5,'2_July 2025':5,'3_July 2025':5,'4_July 2025':5,'2_Sep 2025':7,'Sep 2025':7,'Oct 2025':8,'Nov 2025':9,'1_Dec_2025':10,'Jan_2026':11};
    const d=months.map(m=>({name:m,orders:0,cost:0,received:0,backOrder:0}));
    orders.forEach(o=>{const i=mm[o.month];if(i!==undefined){d[i].orders++;d[i].cost+=o.totalCost;if(o.status==='Received')d[i].received++;if(o.status==='Back Order')d[i].backOrder++;}});
    return d;
  }, [orders]);
  const statusPieData = useMemo(() => [{name:'Received',value:stats.received,color:'#0B7A3E'},{name:'Back Order',value:stats.backOrder,color:'#C53030'},{name:'Processed/Pending',value:stats.pending,color:'#2563EB'}], [stats]);
  const topItems = useMemo(() => {
    const m={}; orders.forEach(o=>{if(!m[o.description])m[o.description]={name:o.description.length>30?o.description.slice(0,30)+'...':o.description,qty:0,cost:0};m[o.description].qty+=o.quantity;m[o.description].cost+=o.totalCost;});
    return Object.values(m).sort((a,b)=>b.cost-a.cost).slice(0,8);
  }, [orders]);
  const catPriceData = useMemo(() => Object.entries(CATEGORIES).map(([k,c])=>{const i=PARTS_CATALOG.filter(p=>p.c===k);if(!i.length)return null;return{name:c.short,sg:Math.round(i.reduce((s,p)=>s+p.sg,0)/i.length),dist:Math.round(i.reduce((s,p)=>s+p.dist,0)/i.length),count:i.length,color:c.color};}).filter(Boolean),[]);
  const catalogStats = useMemo(()=>{const t=PARTS_CATALOG.length;const cc={};PARTS_CATALOG.forEach(p=>{cc[p.c]=(cc[p.c]||0)+1;});return{total:t,avgSg:PARTS_CATALOG.reduce((s,p)=>s+p.sg,0)/t,avgDist:PARTS_CATALOG.reduce((s,p)=>s+p.dist,0)/t,catCounts:cc};},[]);

  // ── New Order ──
  
  // ── AI Bot State ──
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState([]);
  const [aiBotConfig, setAiBotConfig] = useState({ template: 'sales', customInstructions: '', greeting: "Hi! I'm your Miltenyi inventory assistant. I can help with pricing, orders, and stock checks.", apiKey: '' });
const [customLogo, setCustomLogo] = useState(null);
  const [waAutoReply, setWaAutoReply] = useState(false);
  const [waNotifyRules, setWaNotifyRules] = useState({ orderCreated: true, bulkOrderCreated: true, partArrivalDone: true, deliveryArrival: true, backOrderUpdate: true, lowStockAlert: false, monthlySummary: false, urgentRequest: true });
  const [scheduledNotifs, setScheduledNotifs] = useState({ enabled: true, frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, time: '09:00', lastRun: null, recipients: [], emailEnabled: true, whatsappEnabled: true, reports: { monthlySummary: true, backOrderReport: true, lowStockAlert: true, pendingApprovals: true, orderStats: true } });
const [emailConfig, setEmailConfig] = useState({ senderEmail: 'inventory@miltenyibiotec.com', senderName: 'Miltenyi Inventory Hub', smtpHost: '', smtpPort: 587, enabled: true, approverEmail: '', approvalEnabled: true, approvalKeywords: ['approve', 'approved', 'yes', 'confirm', 'confirmed', 'ok', 'accept', 'accepted'] });
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [waAllowedSenders, setWaAllowedSenders] = useState(['admin']); // usernames allowed to connect WhatsApp
  const [aiConversationLogs, setAiConversationLogs] = useState([]);
  const [aiAdminTab, setAiAdminTab] = useState('knowledge');

  // ── Open Order in New Tab ──
  const openOrderInNewTab = (order) => {
    localStorage.setItem('viewOrderDetail', JSON.stringify(order));
    window.open(`${window.location.origin}${window.location.pathname}?orderDetail=true`, '_blank', 'width=700,height=800,scrollbars=yes,resizable=yes');
  };

  // ── New Order ──
  const [newOrder, setNewOrder] = useState({ materialNo:'', description:'', quantity:1, listPrice:0, orderBy:'Fu Siong', remark:'' });
  const handleMaterialLookup = (matNo) => { const p=catalogLookup[matNo]; if(p) { setNewOrder(prev=>({...prev,materialNo:matNo,description:p.d,listPrice:p.tp})); notify('Part Found',`${p.d}`, 'success'); }};
  const handleSubmitOrder = async () => {
    const o = { id:`ORD-${2000+orders.length}`,...newOrder, quantity:parseInt(newOrder.quantity), listPrice:parseFloat(newOrder.listPrice), totalCost:parseFloat(newOrder.listPrice)*parseInt(newOrder.quantity), orderDate:new Date().toISOString().slice(0,10), arrivalDate:'', qtyReceived:0, backOrder:-parseInt(newOrder.quantity), engineer:'', emailFull:'', emailBack:'', status:'Pending Approval', approvalStatus:'pending', approvalSentDate:new Date().toISOString().slice(0,10), month:'Feb_2026', year:'2026' };
    setOrders(prev=>[o,...prev]); setShowNewOrder(false); setNewOrder({materialNo:'',description:'',quantity:1,listPrice:0,orderBy:'Fu Siong',remark:''});
    notify('Order Created',`${o.description} — ${o.quantity} units`,'success');

    // Auto-notify if rules enabled
    if (emailConfig.enabled && waNotifyRules.orderCreated) {
      setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:`New Order: ${o.id} - ${o.description}`,date:new Date().toISOString().slice(0,10),status:'Sent'},...prev]);
    }
    // Send approval email to approver (Hotmail/Outlook)
    if (emailConfig.enabled && emailConfig.approvalEnabled && emailConfig.approverEmail) {
      const approvalId = `APR-${Date.now()}`;
      setPendingApprovals(prev=>[{id:approvalId, orderId:o.id, orderType:'single', description:o.description, requestedBy:o.orderBy, quantity:o.quantity, totalCost:o.totalCost, sentDate:new Date().toISOString().slice(0,10), status:'pending'},...prev]);
      setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'approval',to:emailConfig.approverEmail,subject:`[APPROVAL] Order ${o.id}`,date:new Date().toISOString().slice(0,10),status:'Pending'},...prev]);
      const mailBody = encodeURIComponent(`Order Approval Request\n\nOrder ID: ${o.id}\nDescription: ${o.description}\nMaterial No: ${o.materialNo||'N/A'}\nQuantity: ${o.quantity}\nTotal: S${o.totalCost.toFixed(2)}\nRequested By: ${o.orderBy}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG`);
      window.open(`mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent('[APPROVAL] Order '+o.id+' - '+o.description)}&body=${mailBody}`, '_blank');
      notify('Approval Email','Approval request opened for '+emailConfig.approverEmail,'info');
    }
    if (waConnected && waNotifyRules.orderCreated) {
      try {
        await fetch(`${WA_API_URL}/send`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ phone: users.find(u=>u.name===o.orderBy)?.phone || '+65 9111 2222', template: 'orderCreated', data: { orderId: o.id, description: o.description, materialNo: o.materialNo, quantity: o.quantity, total: `S$${o.totalCost.toFixed(2)}`, orderBy: o.orderBy, date: o.orderDate }})
        });
        setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'whatsapp',to:o.orderBy,subject:`Order Created: ${o.id}`,date:new Date().toISOString().slice(0,10),status:'Delivered'},...prev]);
        notify('WhatsApp Sent',`Order notification sent to ${o.orderBy}`,'success');
      } catch(e) { console.log('WA send error:', e); }
    }
  };

  // ── Approval Action Handler ──
  const handleApprovalAction = (approvalId, action) => {
    const approval = pendingApprovals.find(a=>a.id===approvalId);
    if (!approval) return;

    setPendingApprovals(prev=>prev.map(a=>a.id===approvalId?{...a,status:action,actionDate:new Date().toISOString().slice(0,10)}:a));

    if (action === 'approved') {
      // Update order status to Approved/Pending
      if (approval.orderType === 'single') {
        setOrders(prev=>prev.map(o=>o.id===approval.orderId?{...o,status:'Pending',approvalStatus:'approved'}:o));
      } else if (approval.orderType === 'bulk' && approval.orderIds) {
        setOrders(prev=>prev.map(o=>approval.orderIds.includes(o.id)?{...o,status:'Pending',approvalStatus:'approved'}:o));
        setBulkGroups(prev=>prev.map(g=>g.id===approval.orderId?{...g,status:'Approved'}:g));
      }
      setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'approval',to:approval.requestedBy,subject:`Order ${approval.orderId} Approved`,date:new Date().toISOString().slice(0,10),status:'Approved'},...prev]);
      notify('Order Approved',`${approval.orderId} has been approved`,'success');
    } else {
      // Update order status to Rejected
      if (approval.orderType === 'single') {
        setOrders(prev=>prev.map(o=>o.id===approval.orderId?{...o,status:'Rejected',approvalStatus:'rejected'}:o));
      } else if (approval.orderType === 'bulk' && approval.orderIds) {
        setOrders(prev=>prev.map(o=>approval.orderIds.includes(o.id)?{...o,status:'Rejected',approvalStatus:'rejected'}:o));
        setBulkGroups(prev=>prev.map(g=>g.id===approval.orderId?{...g,status:'Rejected'}:g));
      }
      setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'approval',to:approval.requestedBy,subject:`Order ${approval.orderId} Rejected`,date:new Date().toISOString().slice(0,10),status:'Rejected'},...prev]);
      notify('Order Rejected',`${approval.orderId} has been rejected`,'warning');
    }
  };

  // ── WhatsApp Baileys functions ──
  // WhatsApp API Base URL
  const WA_API_URL = 'http://localhost:3001/api/whatsapp';

  // Poll for WhatsApp status
  const pollWaStatus = async () => {
    try {
      const res = await fetch(`${WA_API_URL}/status`);
      const data = await res.json();

      if (data.status === 'connected' && !waConnected) {
        setWaConnected(true);
        setWaConnecting(false);
        setWaQrVisible(false);
        setWaSessionInfo(data.sessionInfo);
        notify('WhatsApp Connected', 'Baileys session established', 'success');
      } else if (data.status === 'awaiting_scan' && data.qrCode) {
        setWaQrCode(data.qrCode);
        setWaQrVisible(true);
      } else if (data.status === 'disconnected' && waConnected) {
        setWaConnected(false);
        setWaSessionInfo(null);
      }

      return data.status;
    } catch (err) {
      console.error('WhatsApp status error:', err);
      return 'error';
    }
  };

  const handleWaConnect = async () => {
    setWaConnecting(true);
    try {
      const res = await fetch(`${WA_API_URL}/connect`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        notify('Connecting...', 'Scan QR code with WhatsApp', 'info');

        // Poll for status until connected
        const pollInterval = setInterval(async () => {
          const status = await pollWaStatus();
          if (status === 'connected' || status === 'error') {
            clearInterval(pollInterval);
            setWaConnecting(false);
          }
        }, 2000);

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (!waConnected) {
            setWaConnecting(false);
            setWaQrVisible(false);
            notify('Connection Timeout', 'QR code expired. Try again.', 'warning');
          }
        }, 120000);
      }
    } catch (err) {
      setWaConnecting(false);
      notify('Connection Failed', 'Make sure the server is running', 'warning');
    }
  };

  const handleWaDisconnect = async () => {
    try {
      await fetch(`${WA_API_URL}/disconnect`, { method: 'POST' });
      setWaConnected(false);
      setWaSessionInfo(null);
      setWaQrCode('');
      notify('WhatsApp Disconnected', 'Session closed', 'warning');
    } catch (err) {
      notify('Error', 'Failed to disconnect', 'warning');
    }
  };

  const handleWaSend = async () => {
    if (!waRecipient || !waMessageText) return;

    // Extract phone number from recipient string (e.g., "+65 9111 2222 (Name)")
    const phoneMatch = waRecipient.match(/(\+?\d[\d\s-]+)/);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : waRecipient;

    try {
      const res = await fetch(`${WA_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          template: waTemplate !== 'custom' ? waTemplate : null,
          data: waTemplate === 'custom' ? { message: waMessageText } : getTemplateData(waTemplate)
        })
      });

      const data = await res.json();

      if (data.success) {
        const msg = { id: `WA-${String(waMessages.length+1).padStart(3,'0')}`, to: waRecipient, message: waMessageText, time: new Date().toLocaleString(), status: 'sent' };
        setWaMessages(prev => [msg, ...prev]);
        setNotifLog(prev => [{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'whatsapp',to:waRecipient,subject:waMessageText.slice(0,50),date:new Date().toISOString().slice(0,10),status:'Delivered'},...prev]);
        setWaRecipient(''); setWaMessageText(''); setWaTemplate('custom');
        notify('WhatsApp Sent', `Message delivered to ${phone}`, 'success');

        // Update message status
        setTimeout(() => setWaMessages(prev => prev.map((m,i) => i===0 ? {...m, status:'delivered'} : m)), 2000);
        setTimeout(() => setWaMessages(prev => prev.map((m,i) => i===0 ? {...m, status:'read'} : m)), 5000);
      } else {
        notify('Send Failed', data.error || 'Unknown error', 'warning');
      }
    } catch (err) {
      notify('Send Failed', 'Server connection error', 'warning');
    }
  };

  // Get template data based on current context
  const getTemplateData = (templateId) => {
    const now = new Date();
    switch(templateId) {
      case 'orderCreated':
        return {
          orderId: orders[0]?.id || 'ORD-XXX',
          description: orders[0]?.description || 'Item',
          materialNo: orders[0]?.materialNo || '130-XXX-XXX',
          quantity: orders[0]?.quantity || 1,
          total: fmt(orders[0]?.totalCost || 0),
          orderBy: orders[0]?.orderBy || currentUser?.name,
          date: now.toLocaleDateString()
        };
      case 'backorderReceived':
        const boOrder = orders.find(o => o.backOrder < 0);
        return {
          orderId: boOrder?.id || 'ORD-XXX',
          description: boOrder?.description || 'Item',
          received: boOrder?.qtyReceived || 0,
          ordered: boOrder?.quantity || 0,
          remaining: Math.abs(boOrder?.backOrder || 0)
        };
      case 'deliveryArrival':
        return {
          month: bulkGroups[0]?.month || 'Current Month',
          itemCount: bulkGroups[0]?.items || 0,
          totalValue: fmt(bulkGroups[0]?.totalCost || 0)
        };
      case 'stockAlert':
        return {
          checkId: stockChecks[0]?.id || 'SC-XXX',
          discrepancies: stockChecks[0]?.disc || 0,
          checkedBy: stockChecks[0]?.checkedBy || currentUser?.name,
          date: now.toLocaleDateString()
        };
      case 'monthlyUpdate':
        return {
          month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
          totalOrders: orders.length,
          received: orders.filter(o => o.status === 'Received').length,
          pending: orders.filter(o => o.status === 'Pending').length,
          backOrders: orders.filter(o => o.status === 'Back Order').length,
          totalValue: fmt(orders.reduce((s, o) => s + o.totalCost, 0))
        };
      default:
        return { message: waMessageText };
    }
  };

  // Auto-notify function for system events
  const sendAutoNotify = async (template, data, recipients) => {
    if (!waConnected || !waAutoReply) return;

    for (const phone of recipients) {
      try {
        await fetch(`${WA_API_URL}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, template, data })
        });
      } catch (err) {
        console.error('Auto-notify error:', err);
      }
    }
  };

  const waTemplates = {
    backOrder: (items) => `⚠️ *Back Order Alert*\n\nThe following items are on back order:\n${items||'- Yearly Maintenance Kit, MACSima (5 units)'}\n\nPlease follow up with HQ.\n\n_Miltenyi Biotec SG Service_`,
    deliveryArrived: () => `📦 *Delivery Arrived*\n\nA new shipment has arrived at the warehouse. Please verify the items against the order list.\n\nCheck the Inventory Hub for details.\n\n_Miltenyi Biotec SG Service_`,
    stockAlert: (item) => `🔔 *Stock Level Warning*\n\n${item||'Pump Syringe Hamilton 5ml'} is running low.\nCurrent stock: Below threshold\n\nPlease initiate reorder.\n\n_Miltenyi Biotec SG Service_`,
    monthlyUpdate: (month) => `📊 *Monthly Inventory Update — ${month||'Feb 2026'}*\n\nAll received orders have been verified.\nBack orders: See Inventory Hub\n\nPlease review and confirm.\n\n_Miltenyi Biotec SG Service_`,
  };

  // ── Bulk Order ──
  const addBulkItem = () => setBulkItems(prev=>[...prev,{materialNo:'',description:'',quantity:1,listPrice:0}]);
  const removeBulkItem = (idx) => setBulkItems(prev=>prev.filter((_,i)=>i!==idx));
  const updateBulkItem = (idx, field, val) => {
    setBulkItems(prev=>prev.map((item,i)=>{
      if(i!==idx) return item;
      const updated = {...item,[field]:val};
      if(field==='materialNo' && val.length>=10) {
        const p=catalogLookup[val];
        if(p) return {...updated, description:p.d, listPrice:p.tp};
      }
      return updated;
    }));
  };
  const handleBulkSubmit = async () => {
    const validItems = bulkItems.filter(i=>i.materialNo&&i.description);
    if(!validItems.length) return;
    const newOrders = validItems.map((item,idx)=>({
      id:`ORD-${2000+orders.length+idx}`, materialNo:item.materialNo, description:item.description,
      quantity:parseInt(item.quantity)||1, listPrice:parseFloat(item.listPrice)||0,
      totalCost:(parseFloat(item.listPrice)||0)*(parseInt(item.quantity)||1),
      orderDate:new Date().toISOString().slice(0,10), orderBy:bulkOrderBy, remark:`Bulk: ${bulkMonth} — ${bulkRemark}`,
      arrivalDate:'', qtyReceived:0, backOrder:-(parseInt(item.quantity)||1), engineer:'',
      emailFull:'', emailBack:'', status:'Pending', month:bulkMonth.replace(' ','_'), year:'2026'
    }));
    const bgId = `BG-${String(bulkGroups.length+1).padStart(3,'0')}`;
    const totalCost = newOrders.reduce((s,o)=>s+o.totalCost,0);
    setOrders(prev=>[...newOrders,...prev]);
    setBulkGroups(prev=>[{id:bgId, month:bulkMonth, createdBy:bulkOrderBy, items:newOrders.length, totalCost, status:'Pending', date:new Date().toISOString().slice(0,10)},...prev]);
    setShowBulkOrder(false); setBulkItems([{materialNo:'',description:'',quantity:1,listPrice:0}]); setBulkRemark('');
    notify('Bulk Order Created',`${newOrders.length} items for ${bulkMonth}`,'success');

    // Auto-notify if rules enabled
    if (emailConfig.enabled && waNotifyRules.bulkOrderCreated) {
      setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:`Bulk Order: ${bgId} - ${bulkMonth} (${newOrders.length} items)`,date:new Date().toISOString().slice(0,10),status:'Sent'},...prev]);
    }
    // Send approval email for bulk order to approver (Hotmail/Outlook)
    if (emailConfig.enabled && emailConfig.approvalEnabled && emailConfig.approverEmail) {
      const approvalId = `APR-${Date.now()}`;
      setPendingApprovals(prev=>[{id:approvalId, orderId:bgId, orderType:'bulk', description:`Bulk Order - ${bulkMonth}`, requestedBy:bulkOrderBy, quantity:newOrders.length, totalCost, sentDate:new Date().toISOString().slice(0,10), status:'pending', orderIds:newOrders.map(x=>x.id)},...prev]);
      setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'approval',to:emailConfig.approverEmail,subject:`[APPROVAL] Bulk Order ${bgId}`,date:new Date().toISOString().slice(0,10),status:'Pending'},...prev]);
      const mailBody = encodeURIComponent(`Bulk Order Approval Request\n\nBatch ID: ${bgId}\nMonth: ${bulkMonth}\nItems: ${newOrders.length}\nTotal Cost: S${totalCost.toFixed(2)}\nRequested By: ${bulkOrderBy}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG`);
      window.open(`mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent('[APPROVAL] Bulk Order '+bgId+' - '+bulkMonth)}&body=${mailBody}`, '_blank');
      notify('Approval Email','Bulk order approval request opened','info');
    }
    if (waConnected && waNotifyRules.bulkOrderCreated) {
      try {
        // Notify all engineers
        for (const user of users.filter(u=>u.role!=='admin'&&u.status==='active'&&u.phone)) {
          await fetch(`${WA_API_URL}/send`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ phone: user.phone, template: 'custom', data: { message: `📦 *Bulk Order Created*\n\nBatch: ${bgId}\nMonth: ${bulkMonth}\nItems: ${newOrders.length}\nTotal: S$${totalCost.toFixed(2)}\nCreated By: ${bulkOrderBy}\n\n_Miltenyi Inventory Hub SG_` }})
          });
        }
        setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'whatsapp',to:'All Engineers',subject:`Bulk Order: ${bgId} - ${bulkMonth}`,date:new Date().toISOString().slice(0,10),status:'Delivered'},...prev]);
        notify('WhatsApp Sent',`Bulk order notification sent to team`,'success');
      } catch(e) { console.log('WA send error:', e); }
    }
  };

  // ── Auth Handlers ──
  const handleLogin = () => {
    const user = users.find(u=>u.username===loginForm.username && u.password===loginForm.password && u.status==='active');
    if(user) { setCurrentUser(user); notify(`Welcome back, ${user.name}`, user.role==='admin'?'Admin access granted':'User access granted', 'success'); }
    else notify('Login Failed','Invalid credentials or account not approved','warning');
  };
  const handleRegister = () => {
    if(!regForm.username||!regForm.password||!regForm.name||!regForm.email) { notify('Missing Fields','Please fill all required fields','warning'); return; }
    if(users.find(u=>u.username===regForm.username)||pendingUsers.find(u=>u.username===regForm.username)) { notify('Username Taken','Choose a different username','warning'); return; }
    setPendingUsers(prev=>[...prev,{id:`P${String(prev.length+2).padStart(3,'0')}`,username:regForm.username,name:regForm.name,email:regForm.email,phone:regForm.phone,requestDate:new Date().toISOString().slice(0,10)}]);
    setRegForm({username:'',password:'',name:'',email:'',phone:''});
    setAuthView('login');
    notify('Registration Submitted','Your account is pending admin approval','info');
  };
  const handleApproveUser = (pending) => {
    setUsers(prev=>[...prev,{id:`U${String(prev.length+1).padStart(3,'0')}`,username:pending.username,password:'temp123',name:pending.name,email:pending.email,role:'user',status:'active',created:new Date().toISOString().slice(0,10),phone:pending.phone}]);
    setPendingUsers(prev=>prev.filter(u=>u.id!==pending.id));
    notify('User Approved',`${pending.name} can now login (temp password: temp123)`,'success');
  };
  const handleRejectUser = (id) => { setPendingUsers(prev=>prev.filter(u=>u.id!==id)); notify('Registration Rejected','User has been denied access','warning'); };
  const handleCreateUser = (form) => {
    setUsers(prev=>[...prev,{id:`U${String(prev.length+1).padStart(3,'0')}`,username:form.username,password:form.password,name:form.name,email:form.email,role:form.role||'user',status:'active',created:new Date().toISOString().slice(0,10),phone:form.phone||''}]);
    notify('User Created',`${form.name} (${form.role}) added`,'success');
  };

  // ── Nav ──
  const navItems = [
    { id:'dashboard', label:'Dashboard', icon:Home },
    { id:'catalog', label:'Parts Catalog', icon:Database },
    { id:'orders', label:'Orders', icon:Package },
    { id:'bulkorders', label:'Bulk Orders', icon:Layers },
    { id:'analytics', label:'Analytics', icon:BarChart3 },
    { id:'stockcheck', label:'Stock Check', icon:ClipboardList },
    { id:'delivery', label:'Part Arrival', icon:Truck },
    { id:'whatsapp', label:'WhatsApp', icon:MessageSquare },
    { id:'notifications', label:'Notifications', icon:Bell },
    ...(isAdmin ? [{ id:'aibot', label:'AI Bot Admin', icon:Bot }] : []),
    ...(isAdmin ? [{ id:'users', label:'User Management', icon:Users }] : []),
    { id:'settings', label:'Settings', icon:Settings },
  ];

  // ════════════════════════════ AI BOT PROCESSING ════════════════════════════
  const processAiMessage = (userMessage) => {
    const msg = userMessage.toLowerCase().trim();
    const catalogLookupLocal = PARTS_CATALOG.reduce((acc, p) => { acc[p.m] = p; return acc; }, {});

    // Price check pattern
    const priceMatch = msg.match(/price.*?(\d{3}-\d{3}-\d{3})|^(\d{3}-\d{3}-\d{3})/);
    if (priceMatch || msg.includes("price")) {
      const matNo = priceMatch ? (priceMatch[1] || priceMatch[2]) : null;
      if (matNo && catalogLookupLocal[matNo]) {
        const p = catalogLookupLocal[matNo];
        return { type: "price", text: `📦 **${p.d}** (${matNo})\n\n💰 **Prices (${priceConfig.year}):**\n• SG Price: ${fmt(p.sg)}\n• Distributor: ${fmt(p.dist)}\n• Transfer: ${fmt(p.tp)}\n\nWould you like to place an order?` };
      }
      if (matNo) return { type: "not_found", text: `I couldn't find part number **${matNo}** in the catalog. Please verify the material number.` };
      return { type: "prompt", text: "Please provide a material number (e.g., 130-095-005) to check the price." };
    }

    // Order status pattern
    const orderMatch = msg.match(/status.*?(ord-\d+)|(ord-\d+).*status|order.*(ord-\d+)/i);
    if (orderMatch || msg.includes("status") || msg.includes("track")) {
      const orderId = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3])?.toUpperCase() : null;
      if (orderId) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          return { type: "order", text: `📋 **Order ${order.id}**\n\n• Item: ${order.description}\n• Qty: ${order.quantity}\n• Status: **${order.status}**\n• Ordered: ${fmtDate(order.orderDate)}\n• Arrival: ${order.arrivalDate ? fmtDate(order.arrivalDate) : "Pending"}\n• Received: ${order.qtyReceived}/${order.quantity}` };
        }
        return { type: "not_found", text: `Order **${orderId}** not found. Please check the order ID.` };
      }
      return { type: "prompt", text: "Please provide an order ID (e.g., ORD-027) to check the status." };
    }

    // Stock check pattern
    if (msg.includes("stock") || msg.includes("inventory") || msg.includes("available")) {
      const stockItems = stockChecks.slice(0, 3);
      return { type: "stock", text: `📊 **Recent Stock Checks:**\n\n${stockItems.map(s => `• ${s.id}: ${s.items} items checked, ${s.disc} discrepancies (${s.status})`).join("\n")}\n\nFor detailed stock info, check the Stock Check page.` };
    }

    // Place order pattern
    const placeOrderMatch = msg.match(/order\s*(\d+)?\s*[x×]?\s*(\d{3}-\d{3}-\d{3})/i) || msg.match(/(\d{3}-\d{3}-\d{3})\s*[x×]?\s*(\d+)?.*order/i);
    if (msg.includes("place order") || msg.includes("create order") || placeOrderMatch) {
      if (placeOrderMatch) {
        const matNo = placeOrderMatch[2] || placeOrderMatch[1];
        const qty = placeOrderMatch[1] || placeOrderMatch[2] || 1;
        if (catalogLookupLocal[matNo]) {
          const p = catalogLookupLocal[matNo];
          return { type: "order_confirm", text: `🛒 **Ready to order:**\n\n• Part: ${p.d}\n• Material: ${matNo}\n• Quantity: ${qty}\n• Unit Price: ${fmt(p.tp)}\n• Total: ${fmt(p.tp * parseInt(qty))}\n\nType "confirm" to place this order or "cancel" to abort.`, pendingOrder: { materialNo: matNo, description: p.d, quantity: parseInt(qty), listPrice: p.tp } };
        }
      }
      return { type: "prompt", text: "To place an order, tell me the part number and quantity.\nExample: \"Order 2x 130-095-005\"" };
    }

    // Confirm order
    if (msg === "confirm" && aiMessages.length > 0) {
      const lastBotMsg = [...aiMessages].reverse().find(m => m.role === "bot" && m.pendingOrder);
      if (lastBotMsg?.pendingOrder) {
        const po = lastBotMsg.pendingOrder;
        const newOrd = { id: `ORD-${2000 + orders.length}`, ...po, totalCost: po.listPrice * po.quantity, orderDate: new Date().toISOString().slice(0, 10), arrivalDate: "", qtyReceived: 0, backOrder: -po.quantity, engineer: "", emailFull: "", emailBack: "", status: "Pending", orderBy: currentUser.name, month: "Feb_2026", year: "2026", remark: "Created via AI Assistant" };
        setOrders(prev => [newOrd, ...prev]);
        notify("Order Created", `${po.description} × ${po.quantity}`, "success");
        return { type: "success", text: `✅ **Order Created Successfully!**\n\n• Order ID: ${newOrd.id}\n• Item: ${po.description}\n• Quantity: ${po.quantity}\n• Total: ${fmt(newOrd.totalCost)}\n\nYou can track this order by asking "Status ${newOrd.id}"` };
      }
    }

    // Cancel
    if (msg === "cancel") {
      return { type: "info", text: "Order cancelled. How else can I help you?" };
    }

    // Help
    if (msg.includes("help") || msg === "hi" || msg === "hello") {
      return { type: "help", text: `👋 ${aiBotConfig.greeting}\n\n**I can help you with:**\n• 💰 Check prices - "Price for 130-095-005"\n• 📦 Track orders - "Status ORD-027"\n• 🛒 Place orders - "Order 2x 130-095-005"\n• 📊 Stock levels - "Check stock"\n\nHow can I assist you today?` };
    }

    // Default - would go to AI API in real implementation
    return { type: "ai", text: `I understand you're asking about: "${userMessage}"\n\nThis query would be processed by the AI API for a detailed response. For now, try:\n• Price checks\n• Order status\n• Placing orders\n• Stock information\n\nOr type "help" for available commands.` };
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text: aiInput, time: new Date().toLocaleTimeString() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput("");
    setAiProcessing(true);

    setTimeout(() => {
      const response = processAiMessage(aiInput);
      const botMsg = { id: Date.now() + 1, role: "bot", text: response.text, type: response.type, time: new Date().toLocaleTimeString(), pendingOrder: response.pendingOrder };
      setAiMessages(prev => [...prev, botMsg]);
      setAiProcessing(false);
      setAiConversationLogs(prev => [...prev, { id: `AI-${String(prev.length + 1).padStart(3, "0")}`, user: currentUser.name, query: aiInput, response: response.text.slice(0, 100), time: new Date().toISOString(), type: response.type }]);
    }, 500);
  };

  const handleAiQuickAction = (action) => {
    const prompts = {
      price: "I want to check a price",
      status: "Check order status",
      order: "I want to place an order",
      stock: "Show stock levels"
    };
    setAiInput(prompts[action] || "");
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(f => ({
      id: `KB-${String(aiKnowledgeBase.length + 1).padStart(3, '0')}`,
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      type: f.name.split('.').pop().toUpperCase(),
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: currentUser.name
    }));
    setAiKnowledgeBase(prev => [...prev, ...newFiles]);
    notify('Files Uploaded', `${files.length} file(s) added to knowledge base`, 'success');
  };

  // ── History Import CSV/Excel Parser ──
  const handleHistoryImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        notify('Import Error', 'File appears empty or invalid', 'error');
        return;
      }

      // Parse header row
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

      // Map common header names to our fields
      const headerMap = {
        'id': 'id', 'order id': 'id', 'orderid': 'id',
        'material': 'materialNo', 'material no': 'materialNo', 'materialno': 'materialNo', 'part number': 'materialNo',
        'description': 'description', 'desc': 'description', 'item': 'description', 'item description': 'description',
        'quantity': 'quantity', 'qty': 'quantity', 'ordered': 'quantity',
        'price': 'listPrice', 'list price': 'listPrice', 'listprice': 'listPrice', 'unit price': 'listPrice',
        'total': 'totalCost', 'total cost': 'totalCost', 'totalcost': 'totalCost', 'amount': 'totalCost',
        'order date': 'orderDate', 'orderdate': 'orderDate', 'date': 'orderDate', 'created': 'orderDate',
        'order by': 'orderBy', 'orderby': 'orderBy', 'ordered by': 'orderBy', 'user': 'orderBy', 'created by': 'orderBy',
        'remark': 'remark', 'remarks': 'remark', 'note': 'remark', 'notes': 'remark', 'comment': 'remark',
        'arrival': 'arrivalDate', 'arrival date': 'arrivalDate', 'arrivaldate': 'arrivalDate', 'received date': 'arrivalDate',
        'received': 'qtyReceived', 'qty received': 'qtyReceived', 'qtyreceived': 'qtyReceived', 'received qty': 'qtyReceived',
        'back order': 'backOrder', 'backorder': 'backOrder', 'pending': 'backOrder',
        'engineer': 'engineer', 'assigned': 'engineer', 'assigned to': 'engineer',
        'status': 'status',
        'month': 'month', 'batch': 'month', 'month batch': 'month',
        'year': 'year'
      };

      // Find column indices
      const colMap = {};
      headers.forEach((h, i) => {
        const mappedField = headerMap[h];
        if (mappedField) colMap[mappedField] = i;
      });

      // Parse data rows
      const importedOrders = [];
      const existingIds = new Set(orders.map(o => o.id));
      let nextId = Math.max(...orders.map(o => parseInt(o.id.replace('ORD-', '')) || 0)) + 1;

      for (let i = 1; i < lines.length; i++) {
        // Parse CSV properly handling quoted values
        const values = [];
        let current = '';
        let inQuotes = false;
        for (const char of lines[i]) {
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
          else current += char;
        }
        values.push(current.trim());

        const getValue = (field) => values[colMap[field]]?.replace(/^["']|["']$/g, '') || '';

        // Generate new ID if not provided or if duplicate
        let orderId = getValue('id');
        if (!orderId || existingIds.has(orderId)) {
          orderId = `ORD-${String(nextId++).padStart(4, '0')}`;
        }
        existingIds.add(orderId);

        const qty = parseInt(getValue('quantity')) || 0;
        const received = parseInt(getValue('qtyReceived')) || 0;
        const backOrder = received - qty;

        const order = {
          id: orderId,
          materialNo: getValue('materialNo'),
          description: getValue('description') || 'Imported Item',
          quantity: qty,
          listPrice: parseFloat(getValue('listPrice')) || 0,
          totalCost: parseFloat(getValue('totalCost')) || (parseFloat(getValue('listPrice')) || 0) * qty,
          orderDate: getValue('orderDate') || new Date().toISOString().slice(0, 10),
          orderBy: getValue('orderBy') || currentUser.name,
          remark: getValue('remark') || 'Imported from history',
          arrivalDate: getValue('arrivalDate') || '',
          qtyReceived: received,
          backOrder: backOrder,
          engineer: getValue('engineer') || '',
          emailFull: '',
          emailBack: '',
          status: getValue('status') || (received >= qty && qty > 0 ? 'Received' : received > 0 ? 'Back Order' : 'Pending'),
          month: getValue('month') || `Import_${new Date().toISOString().slice(0, 7)}`,
          year: getValue('year') || new Date().getFullYear().toString()
        };

        if (order.description || order.materialNo) {
          importedOrders.push(order);
        }
      }

      if (importedOrders.length > 0) {
        setHistoryImportData(importedOrders);
        setHistoryImportPreview(true);
        notify('File Parsed', `${importedOrders.length} orders ready to import`, 'success');
      } else {
        notify('Import Error', 'No valid orders found in file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const confirmHistoryImport = () => {
    setOrders(prev => [...prev, ...historyImportData]);
    notify('History Imported', `${historyImportData.length} orders added to system`, 'success');
    setHistoryImportData([]);
    setHistoryImportPreview(false);
  };

  // ════════════════════════════ ORDER DETAIL WINDOW (NEW TAB) ═════════════════════════
  if (isOrderDetailWindow && orderDetailData) {
    const o = orderDetailData;
    return (
      <div style={{ minHeight:'100vh', background:'#F4F6F8', fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", padding:24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap'); .mono{font-family:'JetBrains Mono',monospace}`}</style>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center' }}><Package size={24} color="#fff"/></div>
            <div>
              <h1 style={{ fontSize:18,fontWeight:700,color:'#0F172A' }}>Order Details</h1>
              <span className="mono" style={{ fontSize:12,color:'#64748B' }}>{o.id}</span>
            </div>
          </div>
          <button onClick={()=>window.close()} style={{ padding:'10px 20px',background:'#E2E8F0',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}><X size={16}/> Close Window</button>
        </div>

        <div style={{ background:'#fff',borderRadius:16,padding:28,boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
          {/* Title & Status */}
          <div style={{ marginBottom:20 }}>
            <h2 style={{ fontSize:20,fontWeight:700,marginBottom:8 }}>{o.description}</h2>
            <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
              <Badge status={o.status}/>
              <span className="mono" style={{ fontSize:12,color:'#64748B',padding:'4px 10px',background:'#F8FAFB',borderRadius:6 }}>{o.materialNo||'—'}</span>
            </div>
          </div>

          {/* Key Info Badges */}
          <div style={{ display:'flex',gap:12,marginBottom:24,flexWrap:'wrap' }}>
            {o.orderBy&&<div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#DBEAFE',borderRadius:10 }}>
              <User size={16} color="#2563EB"/>
              <div><div style={{ fontSize:10,color:'#64748B',fontWeight:600 }}>ORDERED BY</div><div style={{ fontSize:14,fontWeight:700,color:'#2563EB' }}>{o.orderBy}</div></div>
            </div>}
            {o.month&&<div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#E6F4ED',borderRadius:10 }}>
              <Calendar size={16} color="#0B7A3E"/>
              <div><div style={{ fontSize:10,color:'#64748B',fontWeight:600 }}>MONTH BATCH</div><div style={{ fontSize:14,fontWeight:700,color:'#0B7A3E' }}>{String(o.month).replace('_',' ')}</div></div>
            </div>}
            {o.orderDate&&<div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#F8FAFB',borderRadius:10 }}>
              <Clock size={16} color="#64748B"/>
              <div><div style={{ fontSize:10,color:'#64748B',fontWeight:600 }}>ORDER DATE</div><div style={{ fontSize:14,fontWeight:700,color:'#374151' }}>{fmtDate(o.orderDate)}</div></div>
            </div>}
          </div>

          {/* Quantity Info */}
          <div style={{ padding:20,borderRadius:12,background:'#F0FDF4',border:'1px solid #BBF7D0',marginBottom:24 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16 }}><Package size={18} color="#059669"/><span style={{ fontWeight:700,fontSize:14,color:'#059669' }}>Quantity Status</span></div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11,color:'#64748B',marginBottom:4 }}>Ordered</div>
                <div className="mono" style={{ fontSize:28,fontWeight:700 }}>{o.quantity}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11,color:'#64748B',marginBottom:4 }}>Received</div>
                <div className="mono" style={{ fontSize:28,fontWeight:700,color:o.qtyReceived>=o.quantity?'#059669':'#D97706' }}>{o.qtyReceived||0}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11,color:'#64748B',marginBottom:4 }}>Back Order</div>
                <div className="mono" style={{ fontSize:28,fontWeight:700,color:(o.backOrder||0)<0?'#DC2626':'#059669' }}>{(o.backOrder||0)<0?o.backOrder:'✓ Full'}</div>
              </div>
            </div>
            {(o.backOrder||0)<0 && <div style={{ marginTop:16,padding:10,background:'#FEF2F2',borderRadius:8,fontSize:12,color:'#DC2626',display:'flex',alignItems:'center',gap:8 }}><AlertCircle size={14}/> {Math.abs(o.backOrder)} items still pending</div>}
            {o.qtyReceived>=o.quantity && o.quantity>0 && <div style={{ marginTop:16,padding:10,background:'#D1FAE5',borderRadius:8,fontSize:12,color:'#059669',display:'flex',alignItems:'center',gap:8 }}><CheckCircle size={14}/> Order fully received</div>}
          </div>

          {/* Price & Details Grid */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:24 }}>
            {[
              {l:'Unit Price',v:o.listPrice>0?fmt(o.listPrice):'—',icon:DollarSign,c:'#0B7A3E'},
              {l:'Total Cost',v:o.totalCost>0?fmt(o.totalCost):'—',icon:DollarSign,c:'#2563EB'},
              {l:'Arrival Date',v:o.arrivalDate?fmtDate(o.arrivalDate):'Pending',icon:Truck,c:'#7C3AED'},
              {l:'Engineer',v:o.engineer||'Not Assigned',icon:User,c:'#D97706'},
              {l:'Email Full Sent',v:o.emailFull||'—',icon:Mail,c:'#64748B'},
              {l:'Email B/O Sent',v:o.emailBack||'—',icon:Mail,c:'#64748B'}
            ].map((f,i)=>(
              <div key={i} style={{ padding:14,borderRadius:10,background:'#F8FAFB',display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ padding:8,background:`${f.c}15`,borderRadius:8 }}><f.icon size={16} color={f.c}/></div>
                <div>
                  <div style={{ fontSize:10,color:'#94A3B8',fontWeight:600,textTransform:'uppercase' }}>{f.l}</div>
                  <div style={{ fontSize:14,fontWeight:600 }}>{f.v}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Remark */}
          {o.remark && (
            <div style={{ padding:16,background:'#FEF3C7',borderRadius:10,marginBottom:24 }}>
              <div style={{ fontSize:11,color:'#92400E',fontWeight:600,marginBottom:6 }}>REMARK</div>
              <div style={{ fontSize:13,color:'#78350F' }}>{o.remark}</div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex',gap:12,paddingTop:16,borderTop:'1px solid #E8ECF0' }}>
            <button onClick={()=>window.print()} style={{ padding:'12px 24px',background:'linear-gradient(135deg,#006837,#00A550)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}><FileText size={16}/> Print</button>
            <button onClick={()=>window.close()} style={{ padding:'12px 24px',background:'#E2E8F0',color:'#64748B',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer' }}>Close</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center',marginTop:24,fontSize:11,color:'#94A3B8' }}>
          Miltenyi Inventory Hub — Singapore • Generated {new Date().toLocaleString()}
        </div>
      </div>
    );
  }

  // ════════════════════════════ LOGIN SCREEN ═════════════════════════
  if (!currentUser) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #003020 0%, #006837 40%, #00A550 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap'); @keyframes fadeUp { from { opacity:0;transform:translateY(20px); } to { opacity:1;transform:translateY(0); } } input{font-family:inherit;font-size:13px;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:10px;outline:none;transition:border-color 0.2s;color:#1A202C;background:#fff;width:100%;box-sizing:border-box;} input:focus{border-color:#0B7A3E;box-shadow:0 0 0 3px rgba(11,122,62,0.15);}`}</style>
        <div style={{ animation:'fadeUp 0.5s ease', width:420, background:'#fff', borderRadius:20, padding:'40px 36px', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,#006837,#00A550)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16 }}><Package size={28} color="#fff"/></div>
            <h1 style={{ fontSize:22,fontWeight:700,color:'#0F172A',letterSpacing:-0.5 }}>Miltenyi Inventory Hub</h1>
            <p style={{ fontSize:13,color:'#94A3B8',marginTop:4 }}>Service Spare Parts Management — Singapore</p>
          </div>

          {authView === 'login' ? (
            <div>
              <div style={{ marginBottom:16 }}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Username</label><input value={loginForm.username} onChange={e=>setLoginForm(p=>({...p,username:e.target.value}))} placeholder="Enter username" onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
              <div style={{ marginBottom:24 }}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Password</label><input type="password" value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))} placeholder="Enter password" onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
              <button onClick={handleLogin} style={{ width:'100%',padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#006837,#00A550)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}><Lock size={16}/> Sign In</button>
              <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#64748B' }}>
                Don't have an account? <button onClick={()=>setAuthView('register')} style={{ background:'none',border:'none',color:'#0B7A3E',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:13 }}>Register here</button>
              </div>
              <div style={{ marginTop:24,padding:12,borderRadius:8,background:'#F8FAFB',fontSize:11,color:'#94A3B8' }}>
                <div style={{fontWeight:600,marginBottom:4,color:'#64748B'}}>Demo Accounts:</div>
                <div>Admin: <span style={{fontFamily:'JetBrains Mono',color:'#0B7A3E'}}>admin / admin123</span></div>
                <div>User: <span style={{fontFamily:'JetBrains Mono',color:'#0B7A3E'}}>fusiong / fs2025</span></div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom:14 }}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Full Name *</label><input value={regForm.name} onChange={e=>setRegForm(p=>({...p,name:e.target.value}))} placeholder="Your full name"/></div>
              <div style={{ marginBottom:14 }}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Email *</label><input type="email" value={regForm.email} onChange={e=>setRegForm(p=>({...p,email:e.target.value}))} placeholder="name@miltenyibiotec.com"/></div>
              <div style={{ marginBottom:14 }}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Phone</label><input value={regForm.phone} onChange={e=>setRegForm(p=>({...p,phone:e.target.value}))} placeholder="+65 9XXX XXXX"/></div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Username *</label><input value={regForm.username} onChange={e=>setRegForm(p=>({...p,username:e.target.value}))} placeholder="Choose username"/></div>
                <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Password *</label><input type="password" value={regForm.password} onChange={e=>setRegForm(p=>({...p,password:e.target.value}))} placeholder="Create password"/></div>
              </div>
              <div style={{ padding:10,borderRadius:8,background:'#FEF3C7',fontSize:11,color:'#92400E',marginBottom:20,display:'flex',alignItems:'center',gap:6 }}><AlertTriangle size={13}/> Your account will need admin approval before you can login.</div>
              <button onClick={handleRegister} style={{ width:'100%',padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#006837,#00A550)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}><UserPlus size={16}/> Request Account</button>
              <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:'#64748B' }}>
                Already have an account? <button onClick={()=>setAuthView('login')} style={{ background:'none',border:'none',color:'#0B7A3E',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:13 }}>Sign in</button>
              </div>
            </div>
          )}
        </div>
        <Toast items={notifs} onDismiss={i=>setNotifs(p=>p.filter((_,j)=>j!==i))}/>
      </div>
    );
  }

  // ════════════════════════════ MAIN APP RENDER ══════════════════════
  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", background:'#F4F6F8', minHeight:'100vh', display:'flex', color:'#1A202C' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px}
        @keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .card{background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.03);transition:box-shadow .2s}
        .card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .bp{background:linear-gradient(135deg,#006837,#0B7A3E 50%,#00A550);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;transition:all .2s;font-family:inherit}
        .bp:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(11,122,62,.3)}
        .bs{background:#F7FAFC;color:#4A5568;border:1px solid #E2E8F0;padding:9px 20px;border-radius:8px;font-weight:500;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        .bs:hover{background:#EDF2F7}
        .bw{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        .be{background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        .bd{background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        input,select,textarea{font-family:inherit;font-size:13px;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;outline:none;transition:border-color .2s;color:#1A202C;background:#fff}
        input:focus,select:focus{border-color:#0B7A3E;box-shadow:0 0 0 3px rgba(11,122,62,.1)}
        .tr{transition:background .15s;cursor:pointer} .tr:hover{background:#F0FDF4!important}
        .ni{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;cursor:pointer;transition:all .15s;font-size:13px;font-weight:500;color:#64748B;margin:2px 0}
        .ni:hover{background:rgba(11,122,62,.06);color:#0B7A3E} .ni.a{background:linear-gradient(135deg,rgba(11,122,62,.1),rgba(0,165,80,.08));color:#0B7A3E;font-weight:600}
        .mo{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}
        .th{padding:12px 14px;text-align:left;font-weight:600;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E8ECF0;white-space:nowrap}
        .td{padding:10px 14px} .mono{font-family:'JetBrains Mono',monospace}
        .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .sc{position:relative;overflow:hidden;border-radius:14px;padding:20px 22px;color:#fff}
        .sc::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1)}
      `}</style>

      <Toast items={notifs} onDismiss={i=>setNotifs(p=>p.filter((_,j)=>j!==i))}/>

      {/* SIDEBAR */}
      <aside style={{ width:sidebarOpen?250:68, background:'#fff', borderRight:'1px solid #E8ECF0', display:'flex', flexDirection:'column', transition:'width .25s', flexShrink:0, zIndex:50 }}>
        <div style={{ padding:sidebarOpen?'20px 18px 16px':'20px 12px 16px', borderBottom:'1px solid #F0F2F5', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:customLogo?'#fff':'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden' }}>{customLogo?<img src={customLogo} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Package size={18} color="#fff"/>}</div>
          {sidebarOpen && <div><div style={{fontWeight:700,fontSize:14,color:'#006837'}}>Miltenyi</div><div style={{fontSize:10,color:'#94A3B8',fontWeight:500,letterSpacing:.5,textTransform:'uppercase'}}>Inventory Hub SG</div></div>}
        </div>
        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          {navItems.map(item=>(
            <div key={item.id} className={`ni ${page===item.id?'a':''}`} onClick={()=>{setPage(item.id);setCatalogPage(0);}} title={item.label}>
              <item.icon size={18}/>
              {sidebarOpen && <span>{item.label}</span>}
              {item.id==='catalog'&&sidebarOpen && <span style={{marginLeft:'auto',fontSize:10,background:'#E6F4ED',color:'#0B7A3E',padding:'2px 6px',borderRadius:8,fontWeight:700}}>{PARTS_CATALOG.length}</span>}
              {item.id==='whatsapp'&&sidebarOpen && <span style={{marginLeft:'auto',width:8,height:8,borderRadius:'50%',background:waConnected?'#25D366':'#E2E8F0'}}/>}
              {item.id==='users'&&sidebarOpen&&pendingUsers.length>0 && <span style={{marginLeft:'auto',fontSize:10,background:'#FEE2E2',color:'#DC2626',padding:'2px 6px',borderRadius:8,fontWeight:700}}>{pendingUsers.length}</span>}
            </div>
          ))}
        </nav>
        <div style={{ padding:'12px 10px', borderTop:'1px solid #F0F2F5' }}>
          <div className="ni" onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu size={18}/>{sidebarOpen&&<span style={{fontSize:12}}>Collapse</span>}</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, overflow:'auto', maxHeight:'100vh' }}>
        <header style={{ background:'#fff', borderBottom:'1px solid #E8ECF0', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 }}>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,color:'#0F172A',letterSpacing:-.5}}>{navItems.find(n=>n.id===page)?.label||'Dashboard'}</h1>
            <p style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Logged in as <strong style={{color:'#0B7A3E'}}>{currentUser.name}</strong> ({currentUser.role}) • Prices {priceConfig.year}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ position:'relative' }}><Search size={15} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:32,width:220,height:36}}/></div>
            {isAdmin && <Pill bg="#DBEAFE" color="#2563EB"><Shield size={11}/> Admin</Pill>}
            <button onClick={()=>setAiPanelOpen(!aiPanelOpen)} className="bs" style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:6,background:aiPanelOpen?'#E6F4ED':'#F8FAFB',border:aiPanelOpen?'1.5px solid #0B7A3E':'1.5px solid #E2E8F0'}} title="AI Assistant">{aiPanelOpen?<PanelRightClose size={16} color="#0B7A3E"/>:<Bot size={16}/>} <span style={{fontSize:12,fontWeight:600,color:aiPanelOpen?'#0B7A3E':'#64748B'}}>AI</span></button>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700}}>{currentUser.name.split(' ').map(w=>w[0]).join('')}</div>
              <button className="bs" style={{padding:'8px 12px',fontSize:12}} onClick={()=>{setCurrentUser(null);setLoginForm({username:'',password:''});}}><LogOut size={14}/>{sidebarOpen?'Logout':''}</button>
            </div>
          </div>
        </header>

        <div style={{ padding:'24px 28px', animation:'fadeIn .3s' }}>

{/* ═══════════ DASHBOARD ═══════════ */}
{page==='dashboard'&&(<div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:24}}>
    {[{l:'Catalog',v:fmtNum(PARTS_CATALOG.length),i:Database,bg:'linear-gradient(135deg,#4338CA,#6366F1)'},{l:'Orders',v:stats.total,i:Package,bg:'linear-gradient(135deg,#006837,#0B9A4E)'},{l:'Spend',v:fmt(stats.totalCost),i:DollarSign,bg:'linear-gradient(135deg,#1E40AF,#3B82F6)'},{l:'Fulfillment',v:`${stats.fulfillmentRate}%`,i:TrendingUp,bg:'linear-gradient(135deg,#047857,#10B981)'},{l:'Back Orders',v:stats.backOrder,i:AlertTriangle,bg:'linear-gradient(135deg,#B91C1C,#EF4444)'}].map((s,i)=>(
      <div key={i} className="sc" style={{background:s.bg}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div style={{fontSize:11,fontWeight:500,opacity:.85,marginBottom:6,textTransform:'uppercase',letterSpacing:.8}}>{s.l}</div><div className="mono" style={{fontSize:24,fontWeight:700,letterSpacing:-1}}>{s.v}</div></div><div style={{background:'rgba(255,255,255,.15)',borderRadius:10,padding:8}}><s.i size={18}/></div></div></div>
    ))}
  </div>
  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:24}}>
    <div className="card" style={{padding:'20px 24px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600}}>Monthly Trends</h3><span style={{fontSize:11,color:'#94A3B8'}}>Feb 2025 — Jan 2026</span></div>
      <ResponsiveContainer width="100%" height={250}><AreaChart data={monthlyData}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0B7A3E" stopOpacity={.15}/><stop offset="95%" stopColor="#0B7A3E" stopOpacity={0}/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={.15}/><stop offset="95%" stopColor="#DC2626" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Area type="monotone" dataKey="received" stroke="#0B7A3E" fillOpacity={1} fill="url(#g1)" name="Received" strokeWidth={2}/><Area type="monotone" dataKey="backOrder" stroke="#DC2626" fillOpacity={1} fill="url(#g2)" name="Back Order" strokeWidth={2}/></AreaChart></ResponsiveContainer>
    </div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Status</h3>
      <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" strokeWidth={0}>{statusPieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
      <div style={{display:'flex',justifyContent:'center',gap:14,marginTop:8}}>{statusPieData.map((s,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748B'}}><div style={{width:8,height:8,borderRadius:'50%',background:s.color}}/>{s.name} ({s.value})</div>)}</div>
    </div>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Top Items by Cost</h3><ResponsiveContainer width="100%" height={260}><BarChart data={topItems} layout="vertical" margin={{left:140}}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:'#94A3B8'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#4A5568'}} axisLine={false} tickLine={false} width={135}/><Tooltip formatter={v=>fmt(v)} contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Bar dataKey="cost" fill="#0B7A3E" radius={[0,6,6,0]} barSize={16}/></BarChart></ResponsiveContainer></div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Avg Price: SG vs Distributor</h3><ResponsiveContainer width="100%" height={260}><BarChart data={catPriceData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:'#94A3B8'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Bar dataKey="sg" name="Singapore" fill="#0B7A3E" radius={[4,4,0,0]} barSize={14}/><Bar dataKey="dist" name="Distributor" fill="#2563EB" radius={[4,4,0,0]} barSize={14}/><Legend iconSize={10} wrapperStyle={{fontSize:11}}/></BarChart></ResponsiveContainer></div>
  </div>
</div>)}

{/* ═══════════ CATALOG ═══════════ */}
{page==='catalog'&&(<div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
    {[{l:'Total Parts',v:fmtNum(catalogStats.total),i:Database,c:'#4338CA'},{l:'Avg SG',v:fmt(catalogStats.avgSg),i:DollarSign,c:'#0B7A3E'},{l:'Avg Dist',v:fmt(catalogStats.avgDist),i:Tag,c:'#2563EB'},{l:'Categories',v:Object.keys(catalogStats.catCounts).length,i:Archive,c:'#D97706'}].map((s,i)=>(
      <div key={i} className="card" style={{padding:'16px 20px'}}><div style={{display:'flex',justifyContent:'space-between'}}><div><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div></div><div style={{padding:10,background:`${s.c}10`,borderRadius:10}}><s.i size={18} color={s.c}/></div></div></div>
    ))}
  </div>
  <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
    <div style={{position:'relative',flex:1,maxWidth:360}}><Search size={15} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input placeholder="Search material no. or description..." value={catalogSearch} onChange={e=>{setCatalogSearch(e.target.value);setCatalogPage(0);}} style={{paddingLeft:32,width:'100%',height:36}}/></div>
    <select value={catFilter} onChange={e=>{setCatFilter(e.target.value);setCatalogPage(0);}} style={{height:36}}><option value="All">All Categories</option>{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.label} ({catalogStats.catCounts[k]||0})</option>)}</select>
    <span style={{fontSize:12,color:'#94A3B8',marginLeft:'auto'}}>{catalog.length} parts</span>
  </div>
  <div className="card" style={{overflow:'hidden'}}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
    <thead><tr style={{background:'#F8FAFB'}}>
      <th className="th" style={{width:120}}>Material No.</th><th className="th">Description</th><th className="th" style={{width:120}}>Category</th>
      {[{k:'tp',l:'Transfer'},{k:'sg',l:'SG Price'},{k:'dist',l:'Dist Price'}].map(h=><th key={h.k} className="th" style={{width:110,textAlign:'right',cursor:'pointer'}} onClick={()=>setCatalogSort(s=>({key:h.k,dir:s.key===h.k&&s.dir==='desc'?'asc':'desc'}))}>{h.l} {catalogSort.key===h.k?(catalogSort.dir==='desc'?'↓':'↑'):''}</th>)}
      <th className="th" style={{width:70,textAlign:'right'}}>Margin</th>
    </tr></thead>
    <tbody>{catalog.slice(catalogPage*PAGE_SIZE,(catalogPage+1)*PAGE_SIZE).map((p,i)=>{const margin=p.singaporePrice>0?((p.singaporePrice-p.distributorPrice)/p.singaporePrice*100).toFixed(1):0;const cc=CATEGORIES[p.category];return(
      <tr key={p.materialNo+i} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD'}} onClick={()=>setSelectedPart(p)}>
        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:500}}>{p.materialNo}</td>
        <td className="td" style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.description}</td>
        <td className="td"><Pill bg={`${cc?.color||'#64748B'}12`} color={cc?.color||'#64748B'}>{cc?.short||'—'}</Pill></td>
        <td className="td mono" style={{textAlign:'right',fontSize:11}}>{p.transferPrice>0?fmt(p.transferPrice):'—'}</td>
        <td className="td mono" style={{textAlign:'right',fontSize:11,fontWeight:600}}>{p.singaporePrice>0?fmt(p.singaporePrice):'—'}</td>
        <td className="td mono" style={{textAlign:'right',fontSize:11}}>{p.distributorPrice>0?fmt(p.distributorPrice):'—'}</td>
        <td className="td mono" style={{textAlign:'right',fontSize:11,color:margin>30?'#0B7A3E':margin>15?'#D97706':'#DC2626'}}>{margin}%</td>
      </tr>);})}</tbody>
  </table></div>
  <div style={{padding:'12px 16px',borderTop:'1px solid #F0F2F5',display:'flex',justifyContent:'space-between',background:'#FCFCFD'}}>
    <span style={{fontSize:12,color:'#94A3B8'}}>Page {catalogPage+1}/{Math.ceil(catalog.length/PAGE_SIZE)}</span>
    <div style={{display:'flex',gap:6}}><button className="bs" style={{padding:'6px 12px',fontSize:12}} disabled={catalogPage===0} onClick={()=>setCatalogPage(p=>p-1)}>← Prev</button><button className="bs" style={{padding:'6px 12px',fontSize:12}} disabled={(catalogPage+1)*PAGE_SIZE>=catalog.length} onClick={()=>setCatalogPage(p=>p+1)}>Next →</button></div>
  </div></div>
</div>)}

{/* ═══════════ ORDERS ═══════════ */}
{page==='orders'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <div style={{display:'flex',gap:8}}>{['All','Received','Back Order','Processed','Pending'].map(s=><button key={s} onClick={()=>setStatusFilter(s)} style={{padding:'6px 14px',borderRadius:20,border:statusFilter===s?'none':'1px solid #E2E8F0',background:statusFilter===s?'#0B7A3E':'#fff',color:statusFilter===s?'#fff':'#64748B',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{s} ({s==='All'?orders.length:orders.filter(o=>o.status===s).length})</button>)}</div>
    <div style={{display:'flex',gap:8}}><button className="bs" onClick={()=>setShowBulkOrder(true)}><Layers size={14}/> Bulk Order</button><button className="bp" onClick={()=>setShowNewOrder(true)}><Plus size={14}/> New Order</button></div>
  </div>
  <div className="card" style={{overflow:'hidden'}}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
    <thead><tr style={{background:'#F8FAFB'}}>{['Material No.','Description','Qty','Price','Total','Ordered','By','Recv','B/O','Status','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
    <tbody>{filteredOrders.map((o,i)=>(
      <tr key={o.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD',cursor:'pointer'}} onClick={()=>openOrderInNewTab(o)}>
        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:500}}>{o.materialNo||'—'}</td>
        <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
        <td className="td mono" style={{fontSize:11}}>{o.listPrice>0?fmt(o.listPrice):'—'}</td>
        <td className="td mono" style={{fontSize:11,fontWeight:600}}>{o.totalCost>0?fmt(o.totalCost):'—'}</td>
        <td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(o.orderDate)}</td>
        <td className="td" style={{fontSize:11}}>{o.orderBy||'—'}</td>
        <td className="td" style={{textAlign:'center',fontWeight:600,color:o.qtyReceived>=o.quantity&&o.quantity>0?'#0B7A3E':'#D97706'}}>{o.qtyReceived}</td>
        <td className="td" style={{textAlign:'center',fontWeight:600,color:o.backOrder<0?'#DC2626':'#0B7A3E'}}>{o.backOrder}</td>
        <td className="td"><Badge status={o.status}/></td>
        <td className="td">
          <div style={{display:'flex',gap:4}}>
            <button onClick={(e)=>{e.stopPropagation();setEditingOrder({...o});}} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Edit3 size={11}/> Edit</button>
          </div>
        </td>
      </tr>))}</tbody>
  </table></div>
  <div style={{padding:'12px 16px',borderTop:'1px solid #F0F2F5',display:'flex',justifyContent:'space-between',background:'#FCFCFD'}}><span style={{fontSize:12,color:'#94A3B8'}}>{filteredOrders.length}/{orders.length}</span><span style={{fontSize:12,fontWeight:500}}>{fmt(filteredOrders.reduce((s,o)=>s+o.totalCost,0))}</span></div></div>
</div>)}

{/* ═══════════ BULK ORDERS ═══════════ */}
{page==='bulkorders'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Create and manage monthly grouped bulk orders for easier tracking</p>
    <button className="bp" onClick={()=>setShowBulkOrder(true)}><FolderPlus size={14}/> Create Bulk Order</button>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
    {[{l:'Total Batches',v:bulkGroups.length,i:Layers,c:'#4338CA'},{l:'Total Items',v:bulkGroups.reduce((s,g)=>s+g.items,0),i:Package,c:'#0B7A3E'},{l:'Total Value',v:fmt(bulkGroups.reduce((s,g)=>s+g.totalCost,0)),i:DollarSign,c:'#2563EB'}].map((s,i)=>(
      <div key={i} className="card" style={{padding:'18px 22px'}}><div style={{display:'flex',justifyContent:'space-between'}}><div><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div><div style={{padding:10,background:`${s.c}10`,borderRadius:10}}><s.i size={20} color={s.c}/></div></div></div>
    ))}
  </div>
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',fontWeight:600,fontSize:14}}>Monthly Bulk Order Batches</div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{['Batch ID','Month','Created By','Items','Total Cost','Status','Date','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{bulkGroups.map(g=>(
        <tr key={g.id} className="tr" style={{borderBottom:'1px solid #F7FAFC'}}>
          <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#4338CA'}}>{g.id}</td>
          <td className="td" style={{fontWeight:600}}><Pill bg="#E6F4ED" color="#0B7A3E"><Calendar size={11}/> {g.month}</Pill></td>
          <td className="td">{g.createdBy}</td>
          <td className="td" style={{fontWeight:600,textAlign:'center'}}>{g.items}</td>
          <td className="td mono" style={{fontWeight:600,fontSize:11}}>{fmt(g.totalCost)}</td>
          <td className="td"><Pill bg={g.status==='Completed'?'#E6F4ED':'#FEF3C7'} color={g.status==='Completed'?'#0B7A3E':'#D97706'}>{g.status}</Pill></td>
          <td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(g.date)}</td>
          <td className="td">
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setSelectedBulkGroup({...g})} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Edit3 size={11}/> Edit</button>
              <button onClick={()=>setExpandedMonth(g.month)} style={{background:'#0B7A3E',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Eye size={11}/> View</button>
            </div>
          </td>
        </tr>))}</tbody>
    </table>
  </div>
  {/* Orders grouped by month batch */}
  <div className="card" style={{padding:'20px 24px',marginTop:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Orders by Month Batch <span style={{fontWeight:400,fontSize:12,color:'#64748B'}}>(Click to view orders)</span></h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
      {[...new Set(orders.map(o=>o.month))].slice(0,16).map(month=>{
        const mo = orders.filter(o=>o.month===month);
        const createdByUsers = [...new Set(mo.map(o=>o.orderBy).filter(Boolean))];
        return <div key={month} onClick={()=>setExpandedMonth(expandedMonth===month?null:month)} style={{padding:14,borderRadius:10,background:expandedMonth===month?'#E6F4ED':'#F8FAFB',border:expandedMonth===month?'2px solid #0B7A3E':'1px solid #E8ECF0',cursor:'pointer',transition:'all 0.2s'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'#0B7A3E',display:'flex',alignItems:'center',gap:6}}><Calendar size={12}/> {month}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
            <div>Orders: <strong>{mo.length}</strong></div>
            <div>Qty: <strong>{mo.reduce((s,o)=>s+o.quantity,0)}</strong></div>
            <div style={{gridColumn:'span 2'}}>Cost: <strong className="mono">{fmt(mo.reduce((s,o)=>s+o.totalCost,0))}</strong></div>
            {createdByUsers.length>0&&<div style={{gridColumn:'span 2',marginTop:4,fontSize:10,color:'#64748B'}}>By: {createdByUsers.join(', ')}</div>}
          </div>
        </div>;
      })}
    </div>
  </div>

  {/* Expanded Month Orders View */}
  {expandedMonth&&(
    <div className="card" style={{padding:'20px 24px',marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8}}><Calendar size={16} color="#0B7A3E"/> Orders for: {expandedMonth}</h3>
        <button onClick={()=>setExpandedMonth(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18} color="#64748B"/></button>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:'#F8FAFB'}}>{['Order ID','Material No','Description','Qty','Ordered By','Order Date','Status','Total Cost','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>{orders.filter(o=>o.month===expandedMonth).map(o=>(
          <tr key={o.id} className="tr" onClick={()=>openOrderInNewTab(o)} style={{borderBottom:'1px solid #F7FAFC',cursor:'pointer'}}>
            <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#4338CA'}}>{o.id}</td>
            <td className="td mono" style={{fontSize:10}}>{o.materialNo||'—'}</td>
            <td className="td" style={{fontSize:11,maxWidth:200}}>{o.description}</td>
            <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
            <td className="td"><Pill bg="#DBEAFE" color="#2563EB"><User size={10}/> {o.orderBy||'—'}</Pill></td>
            <td className="td" style={{color:'#64748B',fontSize:11}}>{fmtDate(o.orderDate)}</td>
            <td className="td"><Pill bg={o.status==='Received'?'#E6F4ED':o.status==='Back Order'?'#FEF3C7':'#FEE2E2'} color={o.status==='Received'?'#0B7A3E':o.status==='Back Order'?'#D97706':'#DC2626'}>{o.status}</Pill></td>
            <td className="td mono" style={{fontWeight:600,fontSize:11}}>{fmt(o.totalCost)}</td>
            <td className="td">
              <button onClick={(e)=>{e.stopPropagation();setEditingOrder({...o});}} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Edit3 size={11}/> Edit</button>
            </td>
          </tr>))}</tbody>
      </table>
      <div style={{marginTop:12,padding:12,background:'#F8FAFB',borderRadius:8,fontSize:12}}>
        <strong>Summary:</strong> {orders.filter(o=>o.month===expandedMonth).length} orders |
        Total Qty: {orders.filter(o=>o.month===expandedMonth).reduce((s,o)=>s+o.quantity,0)} |
        Total Cost: <strong className="mono">{fmt(orders.filter(o=>o.month===expandedMonth).reduce((s,o)=>s+o.totalCost,0))}</strong>
      </div>
    </div>
  )}
</div>)}

{/* ═══════════ ANALYTICS ═══════════ */}
{page==='analytics'&&(<div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Monthly Spend</h3><ResponsiveContainer width="100%" height={270}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Bar dataKey="cost" radius={[6,6,0,0]} barSize={22}>{monthlyData.map((_,i)=><Cell key={i} fill={i===monthlyData.length-1?'#00A550':'#0B7A3E'}/>)}</Bar></BarChart></ResponsiveContainer></div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Order Volume vs Received</h3><ResponsiveContainer width="100%" height={270}><LineChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="orders" stroke="#0B7A3E" strokeWidth={2.5} dot={{r:4}} name="Orders"/><Line type="monotone" dataKey="received" stroke="#2563EB" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}} name="Received"/></LineChart></ResponsiveContainer></div>
  </div>
  <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Engineer Activity</h3><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>{['Fu Siong','Wee Boon'].map(eng=>{const eo=orders.filter(o=>o.orderBy===eng||o.engineer===eng);return(<div key={eng} style={{padding:16,borderRadius:12,background:'#F8FAFB'}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700}}>{eng.split(' ').map(w=>w[0]).join('')}</div><div><div style={{fontWeight:600,fontSize:14}}>{eng}</div><div style={{fontSize:11,color:'#94A3B8'}}>FSE</div></div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}><div><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Orders</div><div className="mono" style={{fontSize:18,fontWeight:700}}>{eo.length}</div></div><div><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Checked</div><div className="mono" style={{fontSize:18,fontWeight:700,color:'#0B7A3E'}}>{eo.filter(o=>o.engineer===eng).length}</div></div><div><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Value</div><div className="mono" style={{fontSize:14,fontWeight:700}}>{fmt(eo.reduce((s,o)=>s+o.totalCost,0))}</div></div></div></div>);})}</div></div>
</div>)}

{/* ═══════════ STOCK CHECK ═══════════ */}
{page==='stockcheck'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Upload stock list file and perform inventory audit</p>
  </div>

  {/* Stats */}
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Total Checks',v:stockChecks.length,c:'#4338CA'},
      {l:'Completed',v:stockChecks.filter(s=>s.status==='Completed').length,c:'#0B7A3E'},
      {l:'In Progress',v:stockChecks.filter(s=>s.status==='In Progress').length,c:'#D97706'},
      {l:'Total Discrepancies',v:stockChecks.reduce((s,c)=>s+c.disc,0),c:'#DC2626'}
    ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
  </div>

  {/* Upload Section - Show when no active check */}
  {!stockCheckMode && (
    <div className="card" style={{padding:'24px',marginBottom:20}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Start New Stock Check</h3>
      <p style={{fontSize:12,color:'#64748B',marginBottom:20}}>Upload an Excel (.xlsx) or CSV file with your stock list. File should contain columns: Material No, Description, System Qty</p>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* File Upload */}
        <label style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:'40px 24px',border:'2px dashed #D1D5DB',borderRadius:12,
          background:'#F9FAFB',cursor:'pointer',transition:'all 0.2s'
        }}>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e)=>{
            const file = e.target.files[0];
            if(!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
              const text = evt.target.result;
              const lines = text.split('\n').filter(l=>l.trim());
              const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());

              // Find column indices
              const matIdx = headers.findIndex(h=>h.includes('material') || h.includes('part') || h.includes('sku'));
              const descIdx = headers.findIndex(h=>h.includes('desc') || h.includes('name') || h.includes('item'));
              const qtyIdx = headers.findIndex(h=>h.includes('qty') || h.includes('quantity') || h.includes('stock') || h.includes('system'));

              const invList = lines.slice(1).map((line,i) => {
                const cols = line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
                return {
                  id: `INV-${String(i+1).padStart(3,'0')}`,
                  materialNo: matIdx>=0 ? cols[matIdx] : cols[0] || '',
                  description: descIdx>=0 ? cols[descIdx] : cols[1] || '',
                  systemQty: parseInt(qtyIdx>=0 ? cols[qtyIdx] : cols[2]) || 0,
                  physicalQty: 0,
                  checked: false
                };
              }).filter(item => item.materialNo);

              if(invList.length > 0) {
                setStockInventoryList(invList);
                setStockCheckMode(true);
                setStockChecks(prev=>[{
                  id:`SC-${String(prev.length+1).padStart(3,'0')}`,
                  date:new Date().toISOString().slice(0,10),
                  checkedBy:currentUser.name,
                  items:invList.length,
                  disc:0,
                  status:'In Progress',
                  notes:`Uploaded: ${file.name}`,
                  inventory:invList
                },...prev]);
                notify('File Uploaded',`${invList.length} items loaded for stock check`,'success');
              } else {
                notify('Invalid File','Could not parse items from file','warning');
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }} style={{display:'none'}}/>
          <Upload size={36} color="#9CA3AF" style={{marginBottom:12}}/>
          <span style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drop file here or click to upload</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>CSV or Excel file (.csv, .xlsx)</span>
        </label>

        {/* File Format Guide */}
        <div style={{padding:'20px',background:'#F8FAFB',borderRadius:12}}>
          <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Expected File Format</h4>
          <div style={{fontFamily:'monospace',fontSize:11,background:'#fff',padding:12,borderRadius:8,border:'1px solid #E2E8F0'}}>
            <div style={{color:'#64748B',marginBottom:4}}>Material No, Description, System Qty</div>
            <div>130-095-005, MACSQuant Analyzer, 5</div>
            <div>130-093-235, Pump Head Assembly, 3</div>
            <div>130-042-303, Tubing Set Sterile, 10</div>
          </div>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:12}}>
            Column headers are flexible - the system will detect: material/part/sku, description/name/item, qty/quantity/stock
          </p>
        </div>
      </div>
    </div>
  )}

  {/* Active Stock Check */}
  {stockCheckMode && stockInventoryList.length>0 && (
    <div className="card" style={{padding:'24px',marginBottom:20,border:'2px solid #0B7A3E'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700}}>Active Stock Check</h3>
          <p style={{fontSize:12,color:'#64748B'}}>Enter physical count for each item • {stockInventoryList.filter(i=>i.checked).length}/{stockInventoryList.length} checked</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="bp" onClick={()=>{
            const discrepancies = stockInventoryList.filter(i=>i.checked && i.physicalQty !== i.systemQty).length;
            setStockChecks(prev=>prev.map((s,idx)=>idx===0?{...s,status:'Completed',disc:discrepancies,notes:`Completed by ${currentUser.name}. ${discrepancies} discrepancies found.`}:s));
            setStockCheckMode(false);
            setStockInventoryList([]);
            notify('Stock Check Completed',`${discrepancies} discrepancies found`,'success');
          }}><Check size={14}/> Complete Check</button>
          <button className="bs" onClick={()=>{setStockCheckMode(false);setStockInventoryList([]);setStockChecks(prev=>prev.slice(1));}}><X size={14}/> Cancel</button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{height:8,background:'#E2E8F0',borderRadius:4,marginBottom:20,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(stockInventoryList.filter(i=>i.checked).length/stockInventoryList.length)*100}%`,background:'linear-gradient(90deg,#006837,#00A550)',borderRadius:4,transition:'width 0.3s'}}/>
      </div>

      <div style={{maxHeight:400,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#F8FAFB',zIndex:10}}><tr><th className="th">Material No.</th><th className="th">Description</th><th className="th" style={{width:100}}>System Qty</th><th className="th" style={{width:120}}>Physical Count</th><th className="th" style={{width:100}}>Variance</th><th className="th" style={{width:80}}>Status</th></tr></thead>
          <tbody>
            {stockInventoryList.map((item,idx)=>{
              const variance = item.checked ? item.physicalQty - item.systemQty : null;
              return (
                <tr key={item.id} style={{borderBottom:'1px solid #F0F2F5',background:item.checked?(variance!==0?'#FEF2F2':'#F0FDF4'):'#fff'}}>
                  <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:600}}>{item.materialNo}</td>
                  <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</td>
                  <td className="td" style={{textAlign:'center',fontWeight:600}}>{item.systemQty}</td>
                  <td className="td" style={{textAlign:'center'}}>
                    <input type="number" min="0" value={item.physicalQty||''} placeholder="0" onChange={e=>{
                      const val = parseInt(e.target.value)||0;
                      setStockInventoryList(prev=>prev.map((x,i)=>i===idx?{...x,physicalQty:val,checked:true}:x));
                    }} style={{width:70,padding:'6px 8px',textAlign:'center',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                  </td>
                  <td className="td" style={{textAlign:'center',fontWeight:700,color:variance===null?'#94A3B8':variance===0?'#059669':variance>0?'#2563EB':'#DC2626'}}>
                    {variance===null?'—':variance===0?'Match':variance>0?`+${variance}`:variance}
                  </td>
                  <td className="td">
                    {item.checked ? (
                      variance===0 ? <Pill bg="#D1FAE5" color="#059669">✓ OK</Pill> : <Pill bg="#FEE2E2" color="#DC2626">Disc.</Pill>
                    ) : <Pill bg="#F3F4F6" color="#9CA3AF">Pending</Pill>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{marginTop:20,padding:16,background:'#F8FAFB',borderRadius:10,display:'flex',justifyContent:'space-between'}}>
        <div><span style={{fontSize:12,color:'#64748B'}}>Checked: </span><strong>{stockInventoryList.filter(i=>i.checked).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Matches: </span><strong style={{color:'#059669'}}>{stockInventoryList.filter(i=>i.checked && i.physicalQty===i.systemQty).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Discrepancies: </span><strong style={{color:'#DC2626'}}>{stockInventoryList.filter(i=>i.checked && i.physicalQty!==i.systemQty).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Pending: </span><strong style={{color:'#D97706'}}>{stockInventoryList.filter(i=>!i.checked).length}</strong></div>
      </div>
    </div>
  )}

  {/* Stock Check History */}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0'}}><span style={{fontWeight:600,fontSize:14}}>Stock Check History</span></div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{['ID','Date','Checked By','Items','Discrepancies','Status','Notes','Action'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{stockChecks.map(r=><tr key={r.id} className="tr" style={{borderBottom:'1px solid #F7FAFC'}}>
        <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#0B7A3E'}}>{r.id}</td>
        <td className="td">{fmtDate(r.date)}</td>
        <td className="td">{r.checkedBy}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center'}}>{r.items}</td>
        <td className="td" style={{textAlign:'center'}}><Pill bg={r.disc>0?'#FEE2E2':'#D1FAE5'} color={r.disc>0?'#DC2626':'#059669'}>{r.disc}</Pill></td>
        <td className="td"><Pill bg={r.status==='Completed'?'#D1FAE5':'#FEF3C7'} color={r.status==='Completed'?'#059669':'#D97706'}>{r.status}</Pill></td>
        <td className="td" style={{color:'#64748B',fontSize:11,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'—'}</td>
        <td className="td">
          {r.status==='Completed' && (
            <button className="bs" style={{padding:'4px 8px',fontSize:11}} onClick={()=>{notify('Report Downloaded',`${r.id} exported`,'success');}}><Download size={12}/></button>
          )}
        </td>
      </tr>)}</tbody>
    </table>
  </div>
</div>)}

{/* ═══════════ PART ARRIVAL CHECK ═══════════ */}
{page==='delivery'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Check and verify material arrivals from bulk orders</p>
  </div>

  {/* Stats Cards */}
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Awaiting Arrival',v:orders.filter(o=>o.status==='Back Order'||o.status==='Pending').length,c:'#D97706'},
      {l:'Fully Received',v:orders.filter(o=>o.qtyReceived>=o.quantity&&o.quantity>0).length,c:'#0B7A3E'},
      {l:'Partial Received',v:orders.filter(o=>o.qtyReceived>0&&o.qtyReceived<o.quantity).length,c:'#2563EB'},
      {l:'Back Orders',v:orders.filter(o=>o.backOrder<0).length,c:'#DC2626'}
    ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
  </div>

  {/* Bulk Orders to Check */}
  <div className="card" style={{padding:'20px 24px',marginBottom:20}}>
    <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Bulk Orders - Arrival Verification</h3>
    <div style={{display:'grid',gap:12}}>
      {bulkGroups.map(bg=>{
        const bgOrders = orders.filter(o=>o.month===String(bg.month||'').replace(' ','_'));
        const fullyReceived = bgOrders.filter(o=>o.qtyReceived>=o.quantity&&o.quantity>0).length;
        const pending = bgOrders.filter(o=>o.qtyReceived<o.quantity).length;
        const hasBackOrder = bgOrders.some(o=>o.backOrder<0);
        return (
          <div key={bg.id} style={{padding:'16px 20px',border:'1px solid #E2E8F0',borderRadius:12,background:selectedBulkForArrival===bg.id?'#E6F4ED':'#fff'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:fullyReceived===bgOrders.length?'#D1FAE5':hasBackOrder?'#FEE2E2':'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {fullyReceived===bgOrders.length?<CheckCircle size={20} color="#059669"/>:hasBackOrder?<AlertCircle size={20} color="#DC2626"/>:<Clock size={20} color="#D97706"/>}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{bg.month} Bulk Order</div>
                  <div style={{fontSize:12,color:'#64748B'}}>{bg.id} • {bgOrders.length} items • {fmt(bg.totalCost)}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{textAlign:'right',marginRight:12}}>
                  <div style={{fontSize:11,color:'#94A3B8'}}>Progress</div>
                  <div style={{fontSize:14,fontWeight:700,color:fullyReceived===bgOrders.length?'#059669':'#D97706'}}>{fullyReceived}/{bgOrders.length} received</div>
                </div>
                <button className={selectedBulkForArrival===bg.id?"bp":"bs"} onClick={()=>{setSelectedBulkForArrival(selectedBulkForArrival===bg.id?null:bg.id);setArrivalItems(bgOrders);}} style={{padding:'8px 16px'}}>
                  {selectedBulkForArrival===bg.id?'Hide':'Check Items'}
                </button>
              </div>
            </div>

            {/* Expanded Items List */}
            {selectedBulkForArrival===bg.id && (
              <div style={{marginTop:16,borderTop:'1px solid #E8ECF0',paddingTop:16}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#F8FAFB'}}><th className="th">Material No.</th><th className="th">Description</th><th className="th" style={{width:70}}>Ordered</th><th className="th" style={{width:80}}>Received</th><th className="th" style={{width:70}}>B/O</th><th className="th" style={{width:100}}>Status</th><th className="th" style={{width:100}}>Action</th></tr></thead>
                  <tbody>
                    {bgOrders.map((o,idx)=>(
                      <tr key={o.id} style={{borderBottom:'1px solid #F0F2F5'}}>
                        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:600}}>{o.materialNo||'—'}</td>
                        <td className="td" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
                        <td className="td" style={{textAlign:'center',fontWeight:600}}>{o.quantity}</td>
                        <td className="td" style={{textAlign:'center'}}>
                          <input type="number" min="0" max={o.quantity} value={o.qtyReceived} onChange={e=>{const val=parseInt(e.target.value)||0;setOrders(prev=>prev.map(x=>x.id===o.id?{...x,qtyReceived:val,backOrder:val-x.quantity,status:val>=x.quantity?'Received':val>0?'Back Order':'Pending'}:x));}} style={{width:50,padding:'4px 6px',textAlign:'center',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                        </td>
                        <td className="td" style={{textAlign:'center',fontWeight:600,color:o.quantity-o.qtyReceived>0?'#DC2626':'#059669'}}>{o.quantity-o.qtyReceived>0?`-${o.quantity-o.qtyReceived}`:'✓'}</td>
                        <td className="td"><Pill bg={o.qtyReceived>=o.quantity?'#D1FAE5':o.qtyReceived>0?'#DBEAFE':'#FEF3C7'} color={o.qtyReceived>=o.quantity?'#059669':o.qtyReceived>0?'#2563EB':'#D97706'}>{o.qtyReceived>=o.quantity?'Full':o.qtyReceived>0?'Partial':'Pending'}</Pill></td>
                        <td className="td">
                          {o.qtyReceived>=o.quantity && <Check size={14} color="#059669"/>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Notify Actions */}
                <div style={{display:'flex',gap:10,marginTop:16,paddingTop:16,borderTop:'1px solid #E8ECF0',flexWrap:'wrap'}}>
                  <button className="be" onClick={()=>{
                    const summary = bgOrders.map(o=>`• ${o.materialNo}: ${o.qtyReceived}/${o.quantity} ${o.qtyReceived>=o.quantity?'✓':'(B/O: '+(o.quantity-o.qtyReceived)+')'}`).join('\n');
                    notify('Email Sent',`Arrival report for ${bg.month} sent`,'success');
                    setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:`Arrival Check: ${bg.month}`,date:new Date().toISOString().slice(0,10),status:'Sent'},...prev]);
                  }}><Mail size={14}/> Email Report</button>
                  {waConnected ? (
                    <button className="bw" onClick={async ()=>{
                      const received = bgOrders.filter(o=>o.qtyReceived>=o.quantity).length;
                      const backorder = bgOrders.filter(o=>o.qtyReceived<o.quantity).length;
                      const itemsList = bgOrders.slice(0,5).map(o=>`• ${o.description.slice(0,30)}: ${o.qtyReceived}/${o.quantity}`).join('\n');
                      try {
                        // Send to all engineers if partArrivalDone rule enabled
                        if (waNotifyRules.partArrivalDone) {
                          for (const user of users.filter(u=>u.role!=='admin'&&u.status==='active'&&u.phone)) {
                            await fetch(`${WA_API_URL}/send`, {
                              method: 'POST', headers: {'Content-Type':'application/json'},
                              body: JSON.stringify({ phone: user.phone, template: 'custom', data: { message: `📦 *Part Arrival Verified*\n\nBatch: ${bg.month}\n✅ Fully Received: ${received}\n⚠️ Back Order: ${backorder}\n\nItems:\n${itemsList}${bgOrders.length>5?`\n...and ${bgOrders.length-5} more`:''}` }})
                            });
                          }
                        }
                        notify('WhatsApp Sent',`Arrival report for ${bg.month} sent`,'success');
                        setNotifLog(prev=>[{id:`N-${String(prev.length+1).padStart(3,'0')}`,type:'whatsapp',to:'SG Service Team',subject:`Arrival: ${bg.month} - ${received} full, ${backorder} B/O`,date:new Date().toISOString().slice(0,10),status:'Delivered'},...prev]);
                      } catch(e) { notify('Error','Failed to send WhatsApp','error'); }
                    }}><MessageSquare size={14}/> WhatsApp Report</button>
                  ) : (
                    <button className="bs" onClick={()=>{setPage('whatsapp');notify('Connect WhatsApp','Please scan QR code first','info');}} style={{opacity:0.7}}><MessageSquare size={14}/> WhatsApp (Not Connected)</button>
                  )}
                  <button className="bp" onClick={async ()=>{
                    // Mark all as complete and send notification
                    const allReceived = bgOrders.every(o=>o.qtyReceived>=o.quantity);
                    if (allReceived) {
                      setBulkGroups(prev=>prev.map(g=>g.id===bg.id?{...g,status:'Completed'}:g));
                      notify('Arrival Complete',`${bg.month} marked as fully received`,'success');
                      if (waConnected && waNotifyRules.partArrivalDone) {
                        try {
                          await fetch(`${WA_API_URL}/send`, {
                            method: 'POST', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ phone: users.find(u=>u.name===bg.createdBy)?.phone || '+65 9111 2222', template: 'custom', data: { message: `✅ *Arrival Check Complete*\n\nBatch: ${bg.month}\nAll ${bgOrders.length} items received!\nTotal: S$${bg.totalCost.toFixed(2)}\n\n_Miltenyi Inventory Hub SG_` }})
                          });
                        } catch(e) {}
                      }
                    } else {
                      notify('Incomplete',`${bgOrders.filter(o=>o.qtyReceived<o.quantity).length} items still pending`,'error');
                    }
                  }}><CheckCircle size={14}/> Mark Complete</button>
                  <button className="bs" onClick={()=>setSelectedBulkForArrival(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>

  {/* Recent Arrivals Table */}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontWeight:600,fontSize:14}}>All Orders - Arrival Status</span>
      <span style={{fontSize:11,color:'#94A3B8'}}>{orders.length} orders</span>
    </div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{['Material','Description','Ordered','Recv','B/O','Arrival Date','Status'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{orders.slice(0,15).map((o,i)=><tr key={o.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD'}}>
        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:500}}>{o.materialNo||'—'}</td>
        <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center',color:o.qtyReceived>=o.quantity?'#0B7A3E':'#D97706'}}>{o.qtyReceived}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center',color:o.backOrder<0?'#DC2626':'#0B7A3E'}}>{o.backOrder<0?o.backOrder:'—'}</td>
        <td className="td" style={{color:o.arrivalDate?'#1A202C':'#94A3B8',fontSize:11}}>{o.arrivalDate?fmtDate(o.arrivalDate):'—'}</td>
        <td className="td"><Badge status={o.status}/></td>
      </tr>)}</tbody>
    </table>
  </div>
</div>)}

{/* ═══════════ WHATSAPP BAILEYS ═══════════ */}
{page==='whatsapp'&&(<div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
    {/* Connection Panel */}
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <div style={{padding:8,background:'#D1FAE5',borderRadius:10}}><MessageSquare size={18} color="#059669"/></div>
        <div><h3 style={{fontSize:15,fontWeight:600}}>Baileys WhiskeySockets</h3><p style={{fontSize:11,color:'#94A3B8'}}>WhatsApp Web Multi-Device API</p></div>
      </div>

      {/* Connection Status Card */}
      <div className="card" style={{padding:'20px 24px',marginBottom:16,border:waConnected?'2px solid #25D366':'2px solid #E2E8F0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {waConnected ? <Wifi size={20} color="#25D366"/> : <WifiOff size={20} color="#94A3B8"/>}
            <div>
              <div style={{fontWeight:600,fontSize:14,color:waConnected?'#0B7A3E':'#64748B'}}>{waConnected?'Connected':'Disconnected'}</div>
              <div style={{fontSize:11,color:'#94A3B8'}}>{waConnected?'Session active via Baileys Multi-Device':'Scan QR code to connect'}</div>
            </div>
          </div>
          <div style={{width:12,height:12,borderRadius:'50%',background:waConnected?'#25D366':'#E2E8F0',animation:waConnected?'pulse 2s infinite':'none'}}/>
        </div>

        {waConnected && waSessionInfo && (
          <div style={{padding:12,borderRadius:8,background:'#F0FDF4',marginBottom:16,fontSize:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>Phone: <strong className="mono">{waSessionInfo.phone}</strong></div>
              <div>Name: <strong>{waSessionInfo.name}</strong></div>
              <div>Protocol: <strong className="mono" style={{fontSize:10}}>{waSessionInfo.protocol}</strong></div>
              <div>Connected: <strong style={{fontSize:10}}>{waSessionInfo.connectedAt}</strong></div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {waQrVisible && !waConnected && (
          <div style={{textAlign:'center',padding:20,background:'#F8FAFB',borderRadius:12,marginBottom:16}}>
            <div style={{marginBottom:12}}>
              {waQrCode.startsWith("data:") ? <img src={waQrCode} alt="QR Code" style={{width:200,height:200,borderRadius:8}}/> : <QRCodeCanvas text={waQrCode} size={200}/>}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:'#1A202C',marginBottom:4}}>Scan with WhatsApp</div>
            <div style={{fontSize:11,color:'#94A3B8'}}>Open WhatsApp → Linked Devices → Link a Device</div>
            {waConnecting && <div style={{marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:12,color:'#D97706'}}><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Waiting for scan...</div>}
          </div>
        )}

        {!(isAdmin||waAllowedSenders.includes(currentUser?.username)) && !waConnected && (
          <div style={{padding:12,borderRadius:8,background:'#FEF3C7',fontSize:12,color:'#92400E',marginBottom:16,display:'flex',gap:8}}><Shield size={14}/> Only authorized users can connect WhatsApp. Contact admin to be assigned as a sender.</div>
        )}

        <div style={{display:'flex',gap:8}}>
          {!waConnected ? (
            <button className="bw" onClick={handleWaConnect} disabled={!(isAdmin||waAllowedSenders.includes(currentUser?.username))||waConnecting} style={{opacity:(isAdmin||waAllowedSenders.includes(currentUser?.username))?1:.5,flex:1}}>
              {waConnecting?<><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Connecting...</>:<><QrCode size={14}/> {isAdmin?'Scan QR Code':'Admin Only'}</>}
            </button>
          ) : (
            <button className="bd" onClick={handleWaDisconnect} style={{flex:1}}><WifiOff size={14}/> Disconnect Session</button>
          )}
        </div>
      </div>

      {/* Auto-notification Rules */}
      <div className="card" style={{padding:'18px 20px'}}>
        <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Auto-Notify Rules via Baileys</h4>
        {[
          {key:'orderCreated',label:'New order created → Notify team'},
          {key:'bulkOrderCreated',label:'Bulk order created → Notify all engineers'},
          {key:'partArrivalDone',label:'Part arrival verified → Notify requester'},
          {key:'deliveryArrival',label:'Delivery arrival → Notify assigned engineer'},
          {key:'backOrderUpdate',label:'Back order update → Team group'},
          {key:'lowStockAlert',label:'Low stock alert → Supervisor'},
          {key:'monthlySummary',label:'Monthly summary → All engineers'},
          {key:'urgentRequest',label:'Urgent request → Broadcast to all'}
        ].map((rule,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<7?'1px solid #F0F2F5':'none'}}>
            <span style={{fontSize:12.5}}>{rule.label}</span><Toggle active={waNotifyRules[rule.key]} onClick={()=>setWaNotifyRules(prev=>({...prev,[rule.key]:!prev[rule.key]}))} color="#25D366"/>
          </div>
        ))}
      </div>

      {/* Scheduled Reports & Notifications */}
      <div className="card" style={{padding:'18px 20px',marginTop:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{padding:8,background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',borderRadius:10}}><Calendar size={18} color="#fff"/></div>
            <div>
              <h4 style={{fontSize:14,fontWeight:700}}>Scheduled Reports & Notifications</h4>
              <p style={{fontSize:11,color:'#94A3B8'}}>Auto-send reports via Email & WhatsApp</p>
            </div>
          </div>
          <Toggle active={scheduledNotifs.enabled} onClick={()=>setScheduledNotifs(prev=>({...prev,enabled:!prev.enabled}))} color="#7C3AED"/>
        </div>

        {scheduledNotifs.enabled && (
          <div style={{display:'grid',gap:14}}>
            {/* Schedule Frequency */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>Frequency</label>
                <select value={scheduledNotifs.frequency} onChange={e=>setScheduledNotifs(prev=>({...prev,frequency:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>
                  {scheduledNotifs.frequency==='weekly'||scheduledNotifs.frequency==='biweekly'?'Day of Week':scheduledNotifs.frequency==='monthly'?'Day of Month':'Time'}
                </label>
                {(scheduledNotifs.frequency==='weekly'||scheduledNotifs.frequency==='biweekly')&&(
                  <select value={scheduledNotifs.dayOfWeek} onChange={e=>setScheduledNotifs(prev=>({...prev,dayOfWeek:parseInt(e.target.value)}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                {scheduledNotifs.frequency==='monthly'&&(
                  <select value={scheduledNotifs.dayOfMonth} onChange={e=>setScheduledNotifs(prev=>({...prev,dayOfMonth:parseInt(e.target.value)}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                    {Array.from({length:28},(_,i)=><option key={i+1} value={i+1}>{i+1}{i===0?'st':i===1?'nd':i===2?'rd':'th'}</option>)}
                  </select>
                )}
                {scheduledNotifs.frequency==='daily'&&(
                  <input type="time" value={scheduledNotifs.time} onChange={e=>setScheduledNotifs(prev=>({...prev,time:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                )}
              </div>
            </div>

            {/* Send Time for non-daily */}
            {scheduledNotifs.frequency!=='daily'&&(
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>Send Time</label>
                <input type="time" value={scheduledNotifs.time} onChange={e=>setScheduledNotifs(prev=>({...prev,time:e.target.value}))} style={{width:150,padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
              </div>
            )}

            {/* Delivery Channels */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Delivery Channels</label>
              <div style={{display:'flex',gap:16}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={scheduledNotifs.emailEnabled} onChange={e=>setScheduledNotifs(prev=>({...prev,emailEnabled:e.target.checked}))}/>
                  <Mail size={14} color={scheduledNotifs.emailEnabled?'#059669':'#9CA3AF'}/> Email
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={scheduledNotifs.whatsappEnabled} onChange={e=>setScheduledNotifs(prev=>({...prev,whatsappEnabled:e.target.checked}))}/>
                  <MessageSquare size={14} color={scheduledNotifs.whatsappEnabled?'#25D366':'#9CA3AF'}/> WhatsApp
                </label>
              </div>
            </div>

            {/* Report Types */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Reports to Include</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {key:'monthlySummary',label:'Order Summary',desc:'Total orders, costs, status breakdown'},
                  {key:'backOrderReport',label:'Back Order Report',desc:'Pending items awaiting delivery'},
                  {key:'lowStockAlert',label:'Low Stock Alerts',desc:'Items below threshold'},
                  {key:'pendingApprovals',label:'Pending Approvals',desc:'Orders awaiting approval'},
                  {key:'orderStats',label:'Order Statistics',desc:'Trends and analytics'}
                ].map(r=>(
                  <label key={r.key} style={{display:'flex',alignItems:'flex-start',gap:8,padding:10,background:scheduledNotifs.reports[r.key]?'#EDE9FE':'#F8FAFB',borderRadius:8,cursor:'pointer',border:scheduledNotifs.reports[r.key]?'1px solid #C4B5FD':'1px solid #E8ECF0'}}>
                    <input type="checkbox" checked={scheduledNotifs.reports[r.key]} onChange={e=>setScheduledNotifs(prev=>({...prev,reports:{...prev.reports,[r.key]:e.target.checked}}))} style={{marginTop:2}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:scheduledNotifs.reports[r.key]?'#5B21B6':'#374151'}}>{r.label}</div>
                      <div style={{fontSize:10,color:'#94A3B8'}}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Recipients</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {users.filter(u=>u.status==='active').map(u=>(
                  <label key={u.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:scheduledNotifs.recipients?.includes(u.email)?'#D1FAE5':'#F8FAFB',borderRadius:16,fontSize:11,cursor:'pointer',border:'1px solid #E8ECF0'}}>
                    <input type="checkbox" checked={scheduledNotifs.recipients?.includes(u.email)} onChange={e=>{
                      if(e.target.checked) setScheduledNotifs(prev=>({...prev,recipients:[...(prev.recipients||[]),u.email]}));
                      else setScheduledNotifs(prev=>({...prev,recipients:(prev.recipients||[]).filter(r=>r!==u.email)}));
                    }} style={{display:'none'}}/>
                    <span style={{color:scheduledNotifs.recipients?.includes(u.email)?'#059669':'#64748B'}}>{u.name}</span>
                    {scheduledNotifs.recipients?.includes(u.email)&&<CheckCircle size={12} color="#059669"/>}
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule Summary & Actions */}
            <div style={{padding:12,background:'#F8FAFB',borderRadius:8,marginTop:4}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>
                    Next Report: {scheduledNotifs.frequency==='daily'?'Today':scheduledNotifs.frequency==='weekly'?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][scheduledNotifs.dayOfWeek]:scheduledNotifs.frequency==='monthly'?'Day '+scheduledNotifs.dayOfMonth:'Every 2 weeks'} at {scheduledNotifs.time}
                  </div>
                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>
                    {Object.values(scheduledNotifs.reports).filter(Boolean).length} reports • {(scheduledNotifs.recipients||[]).length} recipients • {[scheduledNotifs.emailEnabled&&'Email',scheduledNotifs.whatsappEnabled&&'WhatsApp'].filter(Boolean).join(' & ')}
                  </div>
                </div>
                <button onClick={()=>{
                  const reportCount = Object.values(scheduledNotifs.reports).filter(Boolean).length;
                  const recipientCount = (scheduledNotifs.recipients||[]).length;
                  if(recipientCount===0){notify('No Recipients','Please select at least one recipient','warning');return;}

if(scheduledNotifs.emailEnabled){                    setNotifLog(prev=>[{id:'N-'+String(prev.length+1).padStart(3,'0'),type:'email',to:(scheduledNotifs.recipients||[]).join(', '),subject:'Scheduled Report - Miltenyi Inventory',date:new Date().toISOString().slice(0,10),status:'Sent'},...prev]);                  }                  if(scheduledNotifs.whatsappEnabled&&waConnected){                    setNotifLog(prev=>[{id:'N-'+String(prev.length+1).padStart(3,'0'),type:'whatsapp',to:'Team Group',subject:'Scheduled Report Sent',date:new Date().toISOString().slice(0,10),status:'Delivered'},...prev]);                  }                  setScheduledNotifs(prev=>({...prev,lastRun:new Date().toISOString()}));                  notify('Report Sent','Scheduled report sent to '+recipientCount+' recipients','success');                }} style={{padding:'8px 16px',background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>                  <Send size={14}/> Send Now                </button>              </div>              {scheduledNotifs.lastRun&&(                <div style={{marginTop:8,fontSize:10,color:'#94A3B8'}}>                  Last sent: {new Date(scheduledNotifs.lastRun).toLocaleString()}                </div>              )}            </div>          </div>        )}        {!scheduledNotifs.enabled && (          <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Enable to automatically send scheduled reports to your team via Email and WhatsApp.</div>        )}      </div>      {/* AI Bot Auto-Reply */}      <div className="card" style={{padding:'18px 20px',marginTop:16,border:waAutoReply?'2px solid #0B7A3E':'2px solid transparent'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{padding:6,background:waAutoReply?'#D1FAE5':'#F3F4F6',borderRadius:8}}><Bot size={16} color={waAutoReply?'#059669':'#9CA3AF'}/></div>
            <div>
              <h4 style={{fontSize:13,fontWeight:600}}>AI Bot Auto-Reply</h4>
              <p style={{fontSize:11,color:'#94A3B8'}}>Automatically respond to customer keywords</p>
            </div>
          </div>
          <Toggle active={waAutoReply} onClick={()=>setWaAutoReply(!waAutoReply)} color="#0B7A3E"/>
        </div>
        {waAutoReply && (
          <div style={{background:'#F8FAFB',borderRadius:8,padding:12}}>
            <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Active Keyword Triggers:</div>
            {[
              {keyword:'"price" + part number',response:'Returns SG/Dist/Transfer prices'},
              {keyword:'"status" + order ID',response:'Returns order status details'},
              {keyword:'"help"',response:'Lists available commands'},
              {keyword:'"stock"',response:'Returns recent stock check info'}
            ].map((k,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<3?'1px solid #E8ECF0':'none',fontSize:12}}>
                <span style={{fontFamily:'monospace',color:'#0B7A3E'}}>{k.keyword}</span>
                <span style={{color:'#64748B'}}>{k.response}</span>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:'#94A3B8',display:'flex',alignItems:'center',gap:6}}><Zap size={12}/> Bot uses same logic as in-app AI Assistant</div>
          </div>
        )}
        {!waAutoReply && (
          <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Enable to let the bot automatically reply to incoming WhatsApp messages based on keywords.</div>
        )}
      </div>
    </div>

    {/* Send Messages */}
    <div>
      <div className="card" style={{padding:'20px 24px',marginBottom:16}}>
        <h4 style={{fontSize:14,fontWeight:600,marginBottom:14}}>Send Message via Baileys</h4>
        {!waConnected && <div style={{padding:12,borderRadius:8,background:'#FEE2E2',fontSize:12,color:'#DC2626',marginBottom:14,display:'flex',gap:6}}><WifiOff size={13}/> Connect WhatsApp first to send messages</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Template</label>
            <select value={waTemplate} onChange={e=>{setWaTemplate(e.target.value);if(e.target.value!=='custom')setWaMessageText(waTemplates[e.target.value]?.() || '');}} style={{width:'100%'}}>
              <option value="custom">Custom Message</option>
              <option value="backOrder">Back Order Alert</option>
              <option value="deliveryArrived">Delivery Arrived</option>
              <option value="stockAlert">Stock Level Warning</option>
              <option value="monthlyUpdate">Monthly Update</option>
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Recipient</label>
            <select value={waRecipient} onChange={e=>setWaRecipient(e.target.value)} style={{width:'100%'}}>
              <option value="">Select recipient...</option>
              {users.filter(u=>u.status==='active'&&u.phone).map(u=><option key={u.id} value={`${u.phone} (${u.name})`}>{u.name} — {u.phone}</option>)}
              <option value="SG Service Team Group">SG Service Team Group</option>
            </select>
          </div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Message</label><textarea value={waMessageText} onChange={e=>setWaMessageText(e.target.value)} rows={5} style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:12}}/></div>
          <button className="bw" onClick={handleWaSend} disabled={!waConnected} style={{opacity:waConnected?1:.5}}><Send size={14}/> Send via Baileys</button>
        </div>
      </div>

      {/* Message Log */}
      <div className="card" style={{padding:'18px 20px'}}>
        <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Message History</h4>
        <div style={{maxHeight:300,overflow:'auto'}}>
          {waMessages.map(m=>(
            <div key={m.id} style={{padding:'10px 12px',borderBottom:'1px solid #F0F2F5',fontSize:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontWeight:600,color:'#1A202C'}}>{m.to}</span>
                <Pill bg={m.status==='read'?'#DBEAFE':m.status==='delivered'?'#D1FAE5':'#FEF3C7'} color={m.status==='read'?'#2563EB':m.status==='delivered'?'#059669':'#D97706'}>{m.status==='read'?'✓✓':'✓'} {m.status}</Pill>
              </div>
              <div style={{color:'#64748B',fontSize:11,marginBottom:2}}>{m.message.slice(0,80)}{m.message.length>80?'...':''}</div>
              <div style={{color:'#94A3B8',fontSize:10}}>{m.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>)}

{/* ═══════════ NOTIFICATIONS ═══════════ */}
{page==='notifications'&&(<div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:24}}>
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{padding:8,background:'#DBEAFE',borderRadius:10}}><Mail size={18} color="#2563EB"/></div><div><h3 style={{fontSize:15,fontWeight:600}}>Email Notifications</h3></div></div>
      <div className="card" style={{padding:'18px 20px',marginBottom:12}}><h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Quick Compose</h4><div style={{display:'flex',flexDirection:'column',gap:10}}><select style={{width:'100%'}}><option>Monthly Full Received</option><option>Back Order Alert</option><option>Delivery Confirmation</option><option>Price List Update</option></select><input type="email" placeholder="Recipients" style={{width:'100%'}}/><textarea placeholder="Notes..." rows={3} style={{width:'100%',resize:'vertical'}}/><button className="be" onClick={()=>{notify('Email Sent','Dispatched','success');setNotifLog(p=>[{id:`N-${String(p.length+1).padStart(3,'0')}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:'Update',date:new Date().toISOString().slice(0,10),status:'Sent'},...p]);}}><Send size={14}/> Send</button></div></div>
    </div>
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{padding:8,background:'#D1FAE5',borderRadius:10}}><MessageSquare size={18} color="#059669"/></div><div><h3 style={{fontSize:15,fontWeight:600}}>WhatsApp (Baileys)</h3><p style={{fontSize:11,color:'#94A3B8'}}>{waConnected?'✓ Connected':'✗ Not connected'} — <button onClick={()=>setPage('whatsapp')} style={{background:'none',border:'none',color:'#0B7A3E',cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:600}}>Manage →</button></p></div></div>
      <div className="card" style={{padding:'18px 20px'}}><p style={{fontSize:12,color:'#64748B',lineHeight:1.6}}>WhatsApp messaging is handled through the <strong>Baileys WhiskeySockets</strong> integration. Go to the WhatsApp page to connect your session, manage templates, and send messages.<br/><br/>Admin must scan QR code to authorize the session.</p></div>
    </div>
  </div>
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:14}}>All Notification History</span><span style={{fontSize:11,color:'#94A3B8'}}>{notifLog.length} records</span></div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}><thead><tr style={{background:'#F8FAFB'}}>{['ID','Channel','To','Subject','Date','Status'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead><tbody>{notifLog.map(n=><tr key={n.id} className="tr" style={{borderBottom:'1px solid #F7FAFC'}}><td className="td mono" style={{fontSize:11,fontWeight:500}}>{n.id}</td><td className="td"><Pill bg={n.type==='email'?'#DBEAFE':'#D1FAE5'} color={n.type==='email'?'#2563EB':'#059669'}>{n.type==='email'?<Mail size={11}/>:<MessageSquare size={11}/>} {n.type==='email'?'Email':'WhatsApp'}</Pill></td><td className="td" style={{fontSize:12,color:'#64748B'}}>{n.to}</td><td className="td" style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.subject}</td><td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(n.date)}</td><td className="td"><Pill bg="#E6F4ED" color="#0B7A3E"><Check size={11}/> {n.status}</Pill></td></tr>)}</tbody></table>
  </div>
</div>)}

{/* ═══════════ USER MANAGEMENT (ADMIN ONLY) ═══════════ */}
{page==='users'&&isAdmin&&(<div>
  {/* Pending Approvals */}
  {pendingUsers.length>0 && (
    <div className="card" style={{padding:'20px 24px',marginBottom:24,border:'2px solid #FDE68A',background:'#FFFBEB'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><AlertTriangle size={18} color="#D97706"/><h3 style={{fontSize:15,fontWeight:600,color:'#92400E'}}>Pending Approvals ({pendingUsers.length})</h3></div>
      {pendingUsers.map(u=>(
        <div key={u.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'#fff',borderRadius:10,marginBottom:8,border:'1px solid #FDE68A'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#D97706,#F59E0B)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,fontWeight:700}}>{u.name.split(' ').map(w=>w[0]).join('')}</div>
            <div><div style={{fontWeight:600,fontSize:14}}>{u.name}</div><div style={{fontSize:11,color:'#94A3B8'}}>{u.email} • {u.username} • Requested: {fmtDate(u.requestDate)}</div></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="bp" style={{padding:'7px 16px'}} onClick={()=>handleApproveUser(u)}><Check size={14}/> Approve</button>
            <button className="bd" style={{padding:'7px 16px'}} onClick={()=>handleRejectUser(u.id)}><X size={14}/> Reject</button>
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Active Users */}
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <h3 style={{fontSize:15,fontWeight:600}}>All Users</h3>
    <button className="bp" onClick={()=>{
      const name=prompt('Full Name:'); if(!name)return;
      const username=prompt('Username:'); if(!username)return;
      const email=prompt('Email:'); const role=prompt('Role (admin/user):','user');
      handleCreateUser({name,username,password:'temp123',email:email||'',role:role||'user',phone:''});
    }}><UserPlus size={14}/> Create User</button>
  </div>
  <div className="card" style={{overflow:'hidden'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{['ID','Name','Username','Email','Role','Status','Created','Phone','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{users.map(u=>(
        <tr key={u.id} className="tr" style={{borderBottom:'1px solid #F7FAFC'}}>
          <td className="td mono" style={{fontSize:11,fontWeight:500}}>{u.id}</td>
          <td className="td"><div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:u.role==='admin'?'linear-gradient(135deg,#1E40AF,#3B82F6)':'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:700}}>{u.name.split(' ').map(w=>w[0]).join('')}</div>
            {u.name}
          </div></td>
          <td className="td mono" style={{fontSize:11}}>{u.username}</td>
          <td className="td" style={{fontSize:11,color:'#64748B'}}>{u.email}</td>
          <td className="td"><Pill bg={u.role==='admin'?'#DBEAFE':'#E6F4ED'} color={u.role==='admin'?'#2563EB':'#0B7A3E'}><Shield size={10}/> {u.role}</Pill></td>
          <td className="td"><Pill bg="#E6F4ED" color="#0B7A3E">{u.status}</Pill></td>
          <td className="td" style={{fontSize:11,color:'#94A3B8'}}>{fmtDate(u.created)}</td>
          <td className="td mono" style={{fontSize:11}}>{u.phone||'—'}</td>
          <td className="td">
            <button onClick={()=>setSelectedUser({...u})} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><Edit3 size={12}/> Edit</button>
          </td>
        </tr>))}</tbody>
    </table>
  </div>
</div>)}

{/* Edit User Modal */}
{selectedUser&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setSelectedUser(null)}>
  <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:420,maxHeight:'80vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <h3 style={{fontSize:16,fontWeight:700}}>Edit User Profile</h3>
      <button onClick={()=>setSelectedUser(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#64748B"/></button>
    </div>
    <div style={{display:'grid',gap:16}}>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Full Name</label>
        <input value={selectedUser.name} onChange={e=>setSelectedUser(prev=>({...prev,name:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Username</label>
        <input value={selectedUser.username} onChange={e=>setSelectedUser(prev=>({...prev,username:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Email</label>
        <input type="email" value={selectedUser.email} onChange={e=>setSelectedUser(prev=>({...prev,email:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Phone Number</label>
        <input value={selectedUser.phone||''} onChange={e=>setSelectedUser(prev=>({...prev,phone:e.target.value}))} placeholder="+65 XXXX XXXX" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Role</label>
          <select value={selectedUser.role} onChange={e=>setSelectedUser(prev=>({...prev,role:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Status</label>
          <select value={selectedUser.status} onChange={e=>setSelectedUser(prev=>({...prev,status:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginTop:8}}>
        <button onClick={()=>setSelectedUser(null)} style={{flex:1,padding:'10px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={()=>{setUsers(prev=>prev.map(u=>u.id===selectedUser.id?selectedUser:u));setSelectedUser(null);}} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#006837,#00A550)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>Save Changes</button>
      </div>
    </div>
  </div>
</div>)}

{/* Edit Bulk Order Modal */}
{selectedBulkGroup&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setSelectedBulkGroup(null)}>
  <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:500,maxHeight:'80vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <h3 style={{fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Layers size={18} color="#4338CA"/> Edit Bulk Order</h3>
      <button onClick={()=>setSelectedBulkGroup(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#64748B"/></button>
    </div>
    <div style={{display:'grid',gap:16}}>
      <div style={{padding:12,background:'#F8FAFB',borderRadius:8}}>
        <div style={{fontSize:11,color:'#64748B',marginBottom:4}}>Batch ID</div>
        <div className="mono" style={{fontWeight:700,color:'#4338CA'}}>{selectedBulkGroup.id}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Month</label>
          <input value={selectedBulkGroup.month} onChange={e=>setSelectedBulkGroup(prev=>({...prev,month:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Created By</label>
          <select value={selectedBulkGroup.createdBy} onChange={e=>setSelectedBulkGroup(prev=>({...prev,createdBy:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            {users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Items Count</label>
          <input type="number" value={selectedBulkGroup.items} onChange={e=>setSelectedBulkGroup(prev=>({...prev,items:parseInt(e.target.value)||0}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Total Cost (S$)</label>
          <input type="number" step="0.01" value={selectedBulkGroup.totalCost} onChange={e=>setSelectedBulkGroup(prev=>({...prev,totalCost:parseFloat(e.target.value)||0}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Status</label>
          <select value={selectedBulkGroup.status} onChange={e=>setSelectedBulkGroup(prev=>({...prev,status:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Date</label>
          <input type="date" value={selectedBulkGroup.date} onChange={e=>setSelectedBulkGroup(prev=>({...prev,date:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginTop:8}}>
        <button onClick={()=>setSelectedBulkGroup(null)} style={{flex:1,padding:'10px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={()=>{setBulkGroups(prev=>prev.map(g=>g.id===selectedBulkGroup.id?selectedBulkGroup:g));setSelectedBulkGroup(null);notify('Bulk Order Updated','Changes saved successfully','success');}} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#4338CA,#6366F1)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>Save Changes</button>
        {(selectedBulkGroup.status==='Pending Approval'||selectedBulkGroup.status==='Pending')&&(
          <div style={{gridColumn:'span 2',marginTop:8,padding:12,background:'#FEF3C7',borderRadius:8,fontSize:11,color:'#92400E'}}>
            <strong>Tip:</strong> If you made changes to a pending order, consider resending the approval email to notify the approver of the updates.
          </div>
        )}
      </div>
    </div>
  </div>
</div>)}



{/* Edit Order Modal */}
{editingOrder&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setEditingOrder(null)}>
  <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:600,maxHeight:'90vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <h3 style={{fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Edit3 size={18} color="#2563EB"/> Edit Order</h3>
      <button onClick={()=>setEditingOrder(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#64748B"/></button>
    </div>

    {/* Warning for pending approval orders */}
    {(editingOrder.status==='Pending Approval'||editingOrder.approvalStatus==='pending')&&(
      <div style={{marginBottom:16,padding:14,background:'#FEF3C7',borderRadius:10,border:'1px solid #FCD34D'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <AlertTriangle size={16} color="#D97706"/>
          <strong style={{fontSize:13,color:'#92400E'}}>Order Pending Approval</strong>
        </div>
        <p style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>This order is awaiting approval. If you make changes, it's recommended to <strong>resend the approval email</strong> to notify the approver of the updates.</p>
      </div>
    )}

    <div style={{display:'grid',gap:14}}>
      <div style={{padding:12,background:'#F8FAFB',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:11,color:'#64748B',marginBottom:2}}>Order ID</div>
          <div className="mono" style={{fontWeight:700,color:'#2563EB'}}>{editingOrder.id}</div>
        </div>
        <Badge status={editingOrder.status}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Material No</label>
          <input value={editingOrder.materialNo||''} onChange={e=>setEditingOrder(prev=>({...prev,materialNo:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}} placeholder="130-XXX-XXX"/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Description</label>
          <input value={editingOrder.description||''} onChange={e=>setEditingOrder(prev=>({...prev,description:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Quantity</label>
          <input type="number" min="1" value={editingOrder.quantity||1} onChange={e=>{const qty=parseInt(e.target.value)||1;setEditingOrder(prev=>({...prev,quantity:qty,totalCost:qty*(prev.listPrice||0),backOrder:(prev.qtyReceived||0)-qty}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Unit Price (S$)</label>
          <input type="number" step="0.01" min="0" value={editingOrder.listPrice||0} onChange={e=>{const price=parseFloat(e.target.value)||0;setEditingOrder(prev=>({...prev,listPrice:price,totalCost:price*(prev.quantity||1)}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Total Cost</label>
          <div className="mono" style={{padding:'10px 12px',borderRadius:8,background:'#E6F4ED',fontSize:13,fontWeight:600,color:'#0B7A3E'}}>{fmt(editingOrder.totalCost||0)}</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Ordered By</label>
          <select value={editingOrder.orderBy||''} onChange={e=>setEditingOrder(prev=>({...prev,orderBy:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="">Select User</option>
            {users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Status</label>
          <select value={editingOrder.status||'Pending'} onChange={e=>setEditingOrder(prev=>({...prev,status:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Pending">Pending</option>
            <option value="Processed">Processed</option>
            <option value="Back Order">Back Order</option>
            <option value="Received">Received</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Order Date</label>
          <input type="date" value={editingOrder.orderDate||''} onChange={e=>setEditingOrder(prev=>({...prev,orderDate:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Qty Received</label>
          <input type="number" min="0" value={editingOrder.qtyReceived||0} onChange={e=>{const recv=parseInt(e.target.value)||0;setEditingOrder(prev=>({...prev,qtyReceived:recv,backOrder:recv-(prev.quantity||0)}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Back Order</label>
          <div className="mono" style={{padding:'10px 12px',borderRadius:8,background:editingOrder.backOrder<0?'#FEE2E2':'#D1FAE5',fontSize:13,fontWeight:600,color:editingOrder.backOrder<0?'#DC2626':'#059669'}}>{editingOrder.backOrder||0}</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Month Batch</label>
          <input value={editingOrder.month||''} onChange={e=>setEditingOrder(prev=>({...prev,month:e.target.value}))} placeholder="Feb 2026" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Arrival Date</label>
          <input type="date" value={editingOrder.arrivalDate||''} onChange={e=>setEditingOrder(prev=>({...prev,arrivalDate:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>

      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Remark</label>
        <textarea value={editingOrder.remark||''} onChange={e=>setEditingOrder(prev=>({...prev,remark:e.target.value}))} rows={2} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
      </div>

      <div style={{display:'flex',gap:10,marginTop:8}}>
        <button onClick={()=>setEditingOrder(null)} style={{flex:1,padding:'12px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={()=>{
          setOrders(prev=>prev.map(o=>o.id===editingOrder.id?editingOrder:o));
          notify('Order Updated',editingOrder.id+' has been updated','success');
          setEditingOrder(null);
        }} style={{flex:1,padding:'12px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#2563EB,#3B82F6)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>Save Changes</button>
      </div>

    </div>
  </div>
</div>)}

{/* History Import Preview Modal */}
{historyImportPreview&&historyImportData.length>0&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>{setHistoryImportPreview(false);setHistoryImportData([]);}}>
  <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:'90%',maxWidth:1000,maxHeight:'85vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{padding:10,background:'linear-gradient(135deg,#4338CA,#6366F1)',borderRadius:12}}><Database size={20} color="#fff"/></div>
        <div>
          <h3 style={{fontSize:17,fontWeight:700}}>Import Preview</h3>
          <p style={{fontSize:12,color:'#64748B'}}>{historyImportData.length} orders ready to import</p>
        </div>
      </div>
      <button onClick={()=>{setHistoryImportPreview(false);setHistoryImportData([]);}} style={{background:'none',border:'none',cursor:'pointer'}}><X size={22} color="#64748B"/></button>
    </div>

    <div style={{marginBottom:16,padding:12,background:'#FEF3C7',borderRadius:8,fontSize:12,color:'#92400E',display:'flex',alignItems:'center',gap:8}}>
      <AlertCircle size={16}/>
      <span>Review the data below before importing. This will add {historyImportData.length} new orders to the system.</span>
    </div>

    <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden',maxHeight:400,overflowY:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead style={{position:'sticky',top:0,background:'#F8FAFB'}}>
          <tr>{['ID','Material No','Description','Qty','Price','Total','Order Date','Order By','Month','Status'].map(h=><th key={h} className="th" style={{padding:'10px 8px',fontSize:10}}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {historyImportData.slice(0,50).map((o,i)=>(
            <tr key={i} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
              <td className="td mono" style={{fontSize:10,color:'#4338CA'}}>{o.id}</td>
              <td className="td mono" style={{fontSize:10}}>{o.materialNo||'—'}</td>
              <td className="td" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
              <td className="td" style={{textAlign:'center',fontWeight:600}}>{o.quantity}</td>
              <td className="td mono">{fmt(o.listPrice)}</td>
              <td className="td mono" style={{fontWeight:600}}>{fmt(o.totalCost)}</td>
              <td className="td" style={{color:'#64748B'}}>{o.orderDate}</td>
              <td className="td"><Pill bg="#DBEAFE" color="#2563EB">{o.orderBy}</Pill></td>
              <td className="td"><Pill bg="#E6F4ED" color="#0B7A3E">{o.month}</Pill></td>
              <td className="td"><Pill bg={o.status==='Received'?'#D1FAE5':o.status==='Back Order'?'#FEF3C7':'#F3F4F6'} color={o.status==='Received'?'#059669':o.status==='Back Order'?'#D97706':'#64748B'}>{o.status}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {historyImportData.length>50&&<div style={{textAlign:'center',padding:10,fontSize:11,color:'#64748B'}}>Showing first 50 of {historyImportData.length} records</div>}

    <div style={{marginTop:16,padding:14,background:'#F0FDF4',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{fontSize:12}}>
        <strong style={{color:'#059669'}}>Summary:</strong> {historyImportData.length} orders |
        Total Qty: {historyImportData.reduce((s,o)=>s+o.quantity,0)} |
        Total Value: <strong className="mono">{fmt(historyImportData.reduce((s,o)=>s+o.totalCost,0))}</strong>
      </div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={()=>{setHistoryImportPreview(false);setHistoryImportData([]);}} style={{padding:'10px 20px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={confirmHistoryImport} style={{padding:'10px 24px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#059669,#10B981)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><Check size={16}/> Import {historyImportData.length} Orders</button>
      </div>
    </div>
  </div>
</div>)}

{/* ═══════════ SETTINGS ═══════════ */}

{/* ═══════════ AI BOT ADMIN (ADMIN ONLY) ═══════════ */}
{page==='aibot'&&isAdmin&&(<div>
  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
    <div style={{padding:10,background:'linear-gradient(135deg,#006837,#00A550)',borderRadius:12}}><Bot size={22} color="#fff"/></div>
    <div><h2 style={{fontSize:18,fontWeight:700}}>AI Bot Administration</h2><p style={{fontSize:12,color:'#94A3B8'}}>Configure knowledge base, bot behavior, and view conversation logs</p></div>
  </div>

  {/* Tabs */}
  <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'2px solid #E8ECF0',paddingBottom:2}}>
    {[{id:'knowledge',label:'Knowledge Base',icon:Database},{id:'config',label:'Bot Configuration',icon:Settings},{id:'logs',label:'Conversation Logs',icon:MessageCircle}].map(tab=>(
      <button key={tab.id} onClick={()=>setAiAdminTab(tab.id)} style={{
        display:'flex',alignItems:'center',gap:6,padding:'10px 16px',border:'none',
        background:aiAdminTab===tab.id?'#E6F4ED':'transparent',
        color:aiAdminTab===tab.id?'#0B7A3E':'#64748B',fontWeight:600,fontSize:13,
        borderRadius:'8px 8px 0 0',cursor:'pointer',fontFamily:'inherit',
        borderBottom:aiAdminTab===tab.id?'2px solid #0B7A3E':'2px solid transparent',marginBottom:-2
      }}><tab.icon size={15}/> {tab.label}</button>
    ))}
  </div>

  {/* Knowledge Base Tab */}
  {aiAdminTab==='knowledge'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Upload Documents</h3>
        <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Upload product manuals, spec sheets, and guides. The bot will use these to answer customer questions.</p>
        <label style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:'32px 24px',border:'2px dashed #D1D5DB',borderRadius:12,
          background:'#F9FAFB',cursor:'pointer',transition:'all 0.2s'
        }}>
          <input type="file" multiple accept=".pdf,.xlsx,.csv,.docx,.txt" onChange={handleFileUpload} style={{display:'none'}}/>
          <Upload size={32} color="#9CA3AF" style={{marginBottom:12}}/>
          <span style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drop files here or click to upload</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>PDF, XLSX, CSV, DOCX, TXT (max 10MB each)</span>
        </label>
      </div>

      {aiKnowledgeBase.length>0 && (
        <div>
          <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Uploaded Files ({aiKnowledgeBase.length})</h4>
          <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#F8FAFB'}}><th className="th">File Name</th><th className="th">Type</th><th className="th">Size</th><th className="th">Uploaded</th><th className="th" style={{width:60}}></th></tr></thead>
              <tbody>
                {aiKnowledgeBase.map(f=>(
                  <tr key={f.id} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
                    <td className="td" style={{display:'flex',alignItems:'center',gap:8}}><FileText size={14} color="#64748B"/>{f.name}</td>
                    <td className="td"><Pill bg="#EEF2FF" color="#4F46E5">{f.type}</Pill></td>
                    <td className="td" style={{color:'#64748B'}}>{f.size}</td>
                    <td className="td" style={{color:'#94A3B8',fontSize:11}}>{f.uploadedAt}</td>
                    <td className="td"><button onClick={()=>setAiKnowledgeBase(prev=>prev.filter(x=>x.id!==f.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aiKnowledgeBase.length===0 && (
        <div style={{textAlign:'center',padding:'24px',background:'#F8FAFB',borderRadius:10}}>
          <Database size={32} color="#D1D5DB" style={{marginBottom:8}}/>
          <p style={{fontSize:13,color:'#9CA3AF'}}>No files uploaded yet. Upload documents to enhance the bot's knowledge.</p>
        </div>
      )}
    </div>
  )}

  {/* Bot Configuration Tab */}
  {aiAdminTab==='config'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{display:'grid',gap:20}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Preset Template</label>
          <select value={aiBotConfig.template} onChange={e=>setAiBotConfig(prev=>({...prev,template:e.target.value}))} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="sales">Friendly Sales Agent</option>
            <option value="support">Technical Support</option>
            <option value="orders">Order Processing Only</option>
            <option value="custom">Custom (Use instructions below)</option>
          </select>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>
            {aiBotConfig.template==='sales'&&'Professional and helpful, focuses on product information and sales.'}
            {aiBotConfig.template==='support'&&'Technical and detailed, focuses on troubleshooting and specs.'}
            {aiBotConfig.template==='orders'&&'Efficient and direct, focuses only on order-related queries.'}
            {aiBotConfig.template==='custom'&&'Fully customizable using your instructions below.'}
          </p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Custom Instructions</label>
          <textarea value={aiBotConfig.customInstructions} onChange={e=>setAiBotConfig(prev=>({...prev,customInstructions:e.target.value}))} placeholder="Add specific instructions for the bot behavior, rules, and response style..." rows={5} style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13,resize:'vertical',fontFamily:'inherit'}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>These instructions override the template defaults.</p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Greeting Message</label>
          <input type="text" value={aiBotConfig.greeting} onChange={e=>setAiBotConfig(prev=>({...prev,greeting:e.target.value}))} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>First message shown when users open the chat.</p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>AI API Key (for complex queries)</label>
          <input type="password" value={aiBotConfig.apiKey} onChange={e=>setAiBotConfig(prev=>({...prev,apiKey:e.target.value}))} placeholder="sk-..." style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13,fontFamily:'monospace'}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>Optional. Used for AI-powered responses to complex questions. Leave empty for rule-based only.</p>
        </div>

        <button className="bp" onClick={()=>notify('Settings Saved','Bot configuration updated','success')} style={{width:'fit-content'}}><Check size={14}/> Save Configuration</button>
      </div>
    </div>
  )}

  {/* Conversation Logs Tab */}
  {aiAdminTab==='logs'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Recent Conversations</h3>
        <span style={{fontSize:12,color:'#94A3B8'}}>{aiConversationLogs.length} queries logged</span>
      </div>

      {aiConversationLogs.length>0 ? (
        <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#F8FAFB'}}><th className="th">ID</th><th className="th">User</th><th className="th">Query</th><th className="th">Type</th><th className="th">Time</th></tr></thead>
            <tbody>
              {aiConversationLogs.slice().reverse().map(log=>(
                <tr key={log.id} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
                  <td className="td mono" style={{fontSize:11}}>{log.id}</td>
                  <td className="td">{log.user}</td>
                  <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.query}</td>
                  <td className="td"><Pill bg={log.type==='success'?'#D1FAE5':log.type==='price'?'#DBEAFE':'#F3F4F6'} color={log.type==='success'?'#059669':log.type==='price'?'#2563EB':'#64748B'}>{log.type}</Pill></td>
                  <td className="td" style={{color:'#94A3B8',fontSize:11}}>{new Date(log.time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{textAlign:'center',padding:'32px',background:'#F8FAFB',borderRadius:10}}>
          <MessageCircle size={32} color="#D1D5DB" style={{marginBottom:8}}/>
          <p style={{fontSize:13,color:'#9CA3AF'}}>No conversations logged yet. Logs will appear here when users interact with the AI assistant.</p>
        </div>
      )}
    </div>
  )}
</div>)}

{page==='settings'&&(<div style={{maxWidth:700}}>

  {/* Logo Settings - Admin Only */}
  {isAdmin && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>App Logo & Branding</h3>
    <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>
      <div style={{width:80,height:80,borderRadius:16,background:customLogo?'#fff':'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #E2E8F0',overflow:'hidden'}}>
        {customLogo ? <img src={customLogo} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/> : <Package size={36} color="#fff"/>}
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:12,color:'#64748B',marginBottom:12}}>Upload a custom logo (PNG, JPG, SVG). Recommended size: 200x200px</p>
        <div style={{display:'flex',gap:8}}>
          <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',background:'#0B7A3E',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            <input type="file" accept="image/*" onChange={(e)=>{
              const file = e.target.files[0];
              if(file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                  setCustomLogo(evt.target.result);
                  notify('Logo Updated','New logo applied','success');
                };
                reader.readAsDataURL(file);
              }
            }} style={{display:'none'}}/>
            <Upload size={14}/> Upload Logo
          </label>
          {customLogo && <button className="bs" onClick={()=>{setCustomLogo(null);notify('Logo Reset','Default logo restored','info');}}><X size={14}/> Remove</button>}
        </div>
      </div>
    </div>
  </div>}

  <div className="card" style={{padding:'24px 28px',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>General</h3><div style={{display:'flex',flexDirection:'column',gap:16}}><div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Company</label><input type="text" defaultValue="Miltenyi Biotec Asia Pacific Pte Ltd" style={{width:'100%'}}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Region</label><select defaultValue="Singapore" style={{width:'100%'}}><option>Singapore</option><option>Malaysia</option></select></div><div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Currency</label><select defaultValue="SGD" style={{width:'100%'}}><option>SGD</option><option>USD</option><option>EUR</option></select></div></div></div></div>
  <div className="card" style={{padding:'24px 28px',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>Price Config (Yearly Update)</h3><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>{[{l:'Year',k:'year',s:1},{l:'EUR/SGD Rate',k:'exchangeRate',s:.01},{l:'SG Markup',k:'sgMarkup',s:.1},{l:'GST',k:'gst',s:.01},{l:'Dist Markup',k:'distMarkup',s:.1},{l:'Special Rate',k:'specialRate',s:.1}].map(f=><div key={f.k}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>{f.l}</label><input type="number" step={f.s} value={priceConfig[f.k]} onChange={e=>setPriceConfig(p=>({...p,[f.k]:parseFloat(e.target.value)}))} style={{width:'100%'}}/></div>)}</div></div>
  <div className="card" style={{padding:'24px 28px',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>WhatsApp Baileys Config</h3><div style={{display:'flex',flexDirection:'column',gap:16}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:13}}>Session Status</span><Pill bg={waConnected?'#D1FAE5':'#FEE2E2'} color={waConnected?'#059669':'#DC2626'}>{waConnected?'Connected':'Disconnected'}</Pill></div><div style={{fontSize:12,color:'#64748B',lineHeight:1.6}}>Baileys WhiskeySockets connects to WhatsApp via the Multi-Device protocol. The admin must scan a QR code to authorize the session. Go to <button onClick={()=>setPage('whatsapp')} style={{background:'none',border:'none',color:'#0B7A3E',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600}}>WhatsApp page</button> to manage.</div></div></div>

  {/* Email Configuration - Admin Only */}
  {isAdmin && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>Email Sender Configuration</h3>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13}}>Email Notifications</span>
        <Toggle active={emailConfig.enabled} onClick={()=>setEmailConfig(prev=>({...prev,enabled:!prev.enabled}))} color="#0B7A3E"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Sender Name</label>
          <input type="text" value={emailConfig.senderName} onChange={e=>setEmailConfig(prev=>({...prev,senderName:e.target.value}))} placeholder="Company Name" style={{width:'100%'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Sender Email</label>
          <input type="email" value={emailConfig.senderEmail} onChange={e=>setEmailConfig(prev=>({...prev,senderEmail:e.target.value}))} placeholder="noreply@company.com" style={{width:'100%'}}/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>SMTP Host (Optional)</label>
          <input type="text" value={emailConfig.smtpHost} onChange={e=>setEmailConfig(prev=>({...prev,smtpHost:e.target.value}))} placeholder="smtp.gmail.com" style={{width:'100%'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>SMTP Port</label>
          <input type="number" value={emailConfig.smtpPort} onChange={e=>setEmailConfig(prev=>({...prev,smtpPort:parseInt(e.target.value)}))} style={{width:'100%'}}/>
        </div>
      </div>
      <div style={{fontSize:11,color:'#94A3B8'}}>Email notifications will be sent from this address. Configure SMTP for production use.</div>
    </div>
  </div>}

  {/* Order Approval Email Configuration - Admin Only */}
  {isAdmin && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20,display:'flex',alignItems:'center',gap:10}}><Shield size={18} color="#7C3AED"/> Order Approval Workflow</h3>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <span style={{fontSize:13,fontWeight:500}}>Require Approval for Orders</span>
          <div style={{fontSize:11,color:'#64748B'}}>Orders require approval before processing</div>
        </div>
        <Toggle active={emailConfig.approvalEnabled} onClick={()=>setEmailConfig(prev=>({...prev,approvalEnabled:!prev.approvalEnabled}))} color="#7C3AED"/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Approver Email (Hotmail/Outlook)</label>
        <input type="email" value={emailConfig.approverEmail||''} onChange={e=>setEmailConfig(prev=>({...prev,approverEmail:e.target.value}))} placeholder="approver@hotmail.com or approver@outlook.com" style={{width:'100%'}}/>
        <div style={{fontSize:11,color:'#64748B',marginTop:4}}>Approval requests will be sent to this email address</div>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Approval Trigger Keywords</label>
        <input type="text" value={(emailConfig.approvalKeywords||[]).join(', ')} onChange={e=>setEmailConfig(prev=>({...prev,approvalKeywords:e.target.value.split(',').map(k=>k.trim().toLowerCase()).filter(k=>k)}))} placeholder="approve, approved, yes, confirm" style={{width:'100%'}}/>
        <div style={{fontSize:11,color:'#64748B',marginTop:4}}>Keywords in reply that trigger approval (comma-separated)</div>
      </div>
      {pendingApprovals.length>0 && (
        <div style={{marginTop:8}}>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Pending Approvals ({pendingApprovals.filter(a=>a.status==='pending').length})</label>
          <div style={{maxHeight:200,overflow:'auto',border:'1px solid #E8ECF0',borderRadius:8}}>
            {pendingApprovals.filter(a=>a.status==='pending').map(a=>(
              <div key={a.id} style={{padding:12,borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600}}>{a.orderId} - {a.description}</div>
                  <div style={{fontSize:11,color:'#64748B'}}>By: {a.requestedBy} | Qty: {a.quantity} | S${a.totalCost?.toFixed(2)||'0.00'}</div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>handleApprovalAction(a.id,'approved')} style={{padding:'6px 12px',background:'#D1FAE5',color:'#059669',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>Approve</button>
                  <button onClick={()=>handleApprovalAction(a.id,'rejected')} style={{padding:'6px 12px',background:'#FEE2E2',color:'#DC2626',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{fontSize:11,color:'#94A3B8',background:'#F8FAFB',padding:12,borderRadius:8}}>
        <strong>How it works:</strong> When an order is created, an approval email opens in your mail client. The approver replies with a trigger keyword. Use the manual approval buttons above, or integrate with Microsoft Graph API for automatic reply detection.
      </div>
    </div>
  </div>}

  {/* WhatsApp Sender Assignment - Admin Only */}
  {isAdmin && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>WhatsApp Sender Assignment</h3>
    <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Assign users who can connect their WhatsApp to send notifications on behalf of the system.</p>

    <div style={{marginBottom:16}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Allowed Senders</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
        {waAllowedSenders.map(username => {
          const user = users.find(u => u.username === username);
          return (
            <div key={username} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'#E6F4ED',borderRadius:20,fontSize:12}}>
              <span style={{fontWeight:600,color:'#0B7A3E'}}>{user?.name || username}</span>
              {username !== 'admin' && (
                <button onClick={()=>setWaAllowedSenders(prev=>prev.filter(u=>u!==username))} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:0,display:'flex'}}><X size={14}/></button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:8}}>
        <select id="addWaSender" style={{flex:1}} defaultValue="">
          <option value="" disabled>Select user to add...</option>
          {users.filter(u => u.status === 'active' && !waAllowedSenders.includes(u.username)).map(u => (
            <option key={u.id} value={u.username}>{u.name} ({u.username})</option>
          ))}
        </select>
        <button className="bp" style={{padding:'8px 16px'}} onClick={()=>{
          const select = document.getElementById('addWaSender');
          if(select.value) {
            setWaAllowedSenders(prev=>[...prev, select.value]);
            notify('Sender Added', `${select.value} can now connect WhatsApp`, 'success');
            select.value = '';
          }
        }}><Plus size={14}/> Add</button>
      </div>
    </div>

    <div style={{padding:12,background:'#F8FAFB',borderRadius:8,fontSize:12,color:'#64748B'}}>
      <strong>How it works:</strong> Assigned users can go to the WhatsApp page and scan QR code with their phone. Their WhatsApp will be used to send system notifications.
    </div>
  </div>}

  {/* History Data Import - Admin Only */}
  {isAdmin && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
      <div style={{padding:8,background:'linear-gradient(135deg,#4338CA,#6366F1)',borderRadius:10}}><Database size={18} color="#fff"/></div>
      <div>
        <h3 style={{fontSize:15,fontWeight:600}}>Import Historical Data</h3>
        <p style={{fontSize:11,color:'#64748B'}}>Upload Excel/CSV files to import past order records</p>
      </div>
    </div>

    <div style={{marginBottom:16}}>
      <label style={{
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        padding:'28px 24px',border:'2px dashed #C7D2FE',borderRadius:12,
        background:'#EEF2FF',cursor:'pointer',transition:'all 0.2s'
      }}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleHistoryImport} style={{display:'none'}}/>
        <Upload size={28} color="#6366F1" style={{marginBottom:10}}/>
        <span style={{fontSize:13,fontWeight:600,color:'#4338CA',marginBottom:4}}>Drop CSV file or click to upload</span>
        <span style={{fontSize:11,color:'#6B7280'}}>Supports CSV format (export Excel as CSV)</span>
      </label>
    </div>

    <div style={{padding:14,background:'#F8FAFB',borderRadius:10,fontSize:12}}>
      <div style={{fontWeight:600,marginBottom:8,color:'#374151'}}>Expected CSV Columns:</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,fontSize:11,color:'#64748B'}}>
        <div>• Material No</div>
        <div>• Description</div>
        <div>• Quantity</div>
        <div>• Price / List Price</div>
        <div>• Total Cost</div>
        <div>• Order Date</div>
        <div>• Order By / Created By</div>
        <div>• Status</div>
        <div>• Month / Batch</div>
        <div>• Received / Qty Received</div>
        <div>• Arrival Date</div>
        <div>• Remark / Notes</div>
      </div>
      <div style={{marginTop:10,padding:8,background:'#FEF3C7',borderRadius:6,fontSize:11,color:'#92400E'}}>
        <strong>Tip:</strong> Export your Excel file as CSV (File → Save As → CSV). Column headers are flexible and will be auto-mapped.
      </div>
    </div>

    {orders.length > 0 && (
      <div style={{marginTop:16,padding:12,background:'#E6F4ED',borderRadius:8,fontSize:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><strong style={{color:'#0B7A3E'}}>{orders.length}</strong> orders currently in system</div>
        <div style={{color:'#64748B'}}>Last import will add to existing records</div>
      </div>
    )}
  </div>}

  <div style={{display:'flex',gap:10}}><button className="bp" onClick={()=>notify('Saved','Settings applied','success')}>Save</button><button className="bs">Reset</button></div>
</div>)}

        </div>
      </main>

      {/* ═══ NEW ORDER MODAL ═══ */}
      {showNewOrder&&<div className="mo" onClick={()=>setShowNewOrder(false)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:520,maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:24}}><h2 style={{fontSize:18,fontWeight:700}}>New Order</h2><button onClick={()=>setShowNewOrder(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Material No. *</label><input value={newOrder.materialNo} onChange={e=>{setNewOrder(p=>({...p,materialNo:e.target.value}));if(e.target.value.length>=10)handleMaterialLookup(e.target.value);}} placeholder="e.g. 130-097-866" style={{width:'100%'}}/></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Description</label><input value={newOrder.description} onChange={e=>setNewOrder(p=>({...p,description:e.target.value}))} style={{width:'100%'}}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Quantity</label><input type="number" min="1" value={newOrder.quantity} onChange={e=>setNewOrder(p=>({...p,quantity:e.target.value}))} style={{width:'100%'}}/></div>
            <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Transfer Price</label><input type="number" step=".01" value={newOrder.listPrice} onChange={e=>setNewOrder(p=>({...p,listPrice:e.target.value}))} style={{width:'100%'}}/></div>
          </div>
          {newOrder.materialNo&&catalogLookup[newOrder.materialNo]&&<div style={{padding:12,borderRadius:8,background:'#F0FDF4',border:'1px solid #BBF7D0',fontSize:12}}><strong style={{color:'#0B7A3E'}}>✓ Catalog Match</strong><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}>
            <div>SG: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].sg)}</strong></div><div>Dist: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].dist)}</strong></div><div>TP: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].tp)}</strong></div></div></div>}
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Order By</label><select value={newOrder.orderBy} onChange={e=>setNewOrder(p=>({...p,orderBy:e.target.value}))} style={{width:'100%'}}>{users.filter(u=>u.status==='active'&&u.role!=='admin').map(u=><option key={u.id}>{u.name}</option>)}</select></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Remark</label><textarea value={newOrder.remark} onChange={e=>setNewOrder(p=>({...p,remark:e.target.value}))} rows={2} style={{width:'100%',resize:'vertical'}}/></div>

          {/* Auto-Notify Status */}
          <div style={{padding:12,borderRadius:8,background:'#F8FAFB',border:'1px solid #E2E8F0'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Auto-Notifications on Submit:</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                <Mail size={12} color={emailConfig.enabled&&waNotifyRules.orderCreated?'#059669':'#9CA3AF'}/>
                <span style={{color:emailConfig.enabled&&waNotifyRules.orderCreated?'#059669':'#9CA3AF'}}>Email {emailConfig.enabled&&waNotifyRules.orderCreated?'✓':'Off'}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                <MessageSquare size={12} color={waConnected&&waNotifyRules.orderCreated?'#25D366':'#9CA3AF'}/>
                <span style={{color:waConnected&&waNotifyRules.orderCreated?'#25D366':'#9CA3AF'}}>WhatsApp {waConnected?waNotifyRules.orderCreated?'✓':'Off':'Not Connected'}</span>
                {!waConnected&&<button onClick={()=>{setShowNewOrder(false);setPage('whatsapp');}} style={{background:'none',border:'none',color:'#2563EB',fontSize:10,cursor:'pointer',textDecoration:'underline'}}>Connect</button>}
              </div>
            </div>
          </div>

          <div style={{display:'flex',gap:10}}><button className="bp" onClick={handleSubmitOrder} style={{flex:1}}><Send size={14}/> Submit & Notify</button><button className="bs" onClick={()=>setShowNewOrder(false)}>Cancel</button></div>
        </div>
      </div></div>}

      {/* ═══ BULK ORDER MODAL ═══ */}
      {showBulkOrder&&<div className="mo" onClick={()=>setShowBulkOrder(false)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:700,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div><h2 style={{fontSize:18,fontWeight:700}}>Create Monthly Bulk Order</h2><p style={{fontSize:12,color:'#94A3B8',marginTop:4}}>Group multiple items under one monthly batch</p></div>
          <button onClick={()=>setShowBulkOrder(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Month Group *</label><select value={bulkMonth} onChange={e=>setBulkMonth(e.target.value)} style={{width:'100%'}}>{MONTH_OPTIONS.map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Order By</label><select value={bulkOrderBy} onChange={e=>setBulkOrderBy(e.target.value)} style={{width:'100%'}}>{users.filter(u=>u.status==='active'&&u.role!=='admin').map(u=><option key={u.id}>{u.name}</option>)}</select></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Batch Remark</label><input value={bulkRemark} onChange={e=>setBulkRemark(e.target.value)} placeholder="e.g. Quarterly restock" style={{width:'100%'}}/></div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontWeight:600,fontSize:13}}>Order Items ({bulkItems.length})</span>
            <button className="bs" style={{padding:'6px 12px',fontSize:12}} onClick={addBulkItem}><Plus size={13}/> Add Item</button>
          </div>
          <div style={{maxHeight:340,overflow:'auto',border:'1px solid #E2E8F0',borderRadius:10}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#F8FAFB',position:'sticky',top:0}}><th className="th" style={{padding:'8px 10px'}}>Material No.</th><th className="th" style={{padding:'8px 10px'}}>Description</th><th className="th" style={{padding:'8px 10px',width:70}}>Qty</th><th className="th" style={{padding:'8px 10px',width:100}}>TP Price</th><th className="th" style={{padding:'8px 10px',width:100}}>Total</th><th className="th" style={{padding:'8px 10px',width:40}}></th></tr></thead>
              <tbody>{bulkItems.map((item,idx)=>(
                <tr key={idx} style={{borderBottom:'1px solid #F0F2F5'}}>
                  <td style={{padding:'8px 10px'}}><input value={item.materialNo} onChange={e=>updateBulkItem(idx,'materialNo',e.target.value)} placeholder="130-XXX-XXX" style={{width:'100%',padding:'6px 8px',fontSize:11}}/></td>
                  <td style={{padding:'8px 10px'}}><input value={item.description} onChange={e=>updateBulkItem(idx,'description',e.target.value)} placeholder="Auto-fills from catalog" style={{width:'100%',padding:'6px 8px',fontSize:11}}/></td>
                  <td style={{padding:'8px 10px'}}><input type="number" min="1" value={item.quantity} onChange={e=>updateBulkItem(idx,'quantity',e.target.value)} style={{width:'100%',padding:'6px 8px',fontSize:11,textAlign:'center'}}/></td>
                  <td style={{padding:'8px 10px'}}><input type="number" step=".01" value={item.listPrice} onChange={e=>updateBulkItem(idx,'listPrice',e.target.value)} style={{width:'100%',padding:'6px 8px',fontSize:11}}/></td>
                  <td className="mono" style={{padding:'8px 10px',textAlign:'right',fontSize:11,fontWeight:600}}>{fmt((parseFloat(item.listPrice)||0)*(parseInt(item.quantity)||0))}</td>
                  <td style={{padding:'8px 10px'}}>{bulkItems.length>1&&<button onClick={()=>removeBulkItem(idx)} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={13}/></button>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',padding:'10px 0',fontSize:13,fontWeight:600}}>
            Batch Total: <span className="mono" style={{color:'#0B7A3E',marginLeft:8}}>{fmt(bulkItems.reduce((s,i)=>(s+(parseFloat(i.listPrice)||0)*(parseInt(i.quantity)||0)),0))}</span>
          </div>
        </div>

        {/* Auto-Notify Status */}
        <div style={{padding:12,borderRadius:8,background:'#F8FAFB',border:'1px solid #E2E8F0',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Auto-Notifications on Create:</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
              <Mail size={12} color={emailConfig.enabled&&waNotifyRules.bulkOrderCreated?'#059669':'#9CA3AF'}/>
              <span style={{color:emailConfig.enabled&&waNotifyRules.bulkOrderCreated?'#059669':'#9CA3AF'}}>Email {emailConfig.enabled&&waNotifyRules.bulkOrderCreated?'✓':'Off'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
              <MessageSquare size={12} color={waConnected&&waNotifyRules.bulkOrderCreated?'#25D366':'#9CA3AF'}/>
              <span style={{color:waConnected&&waNotifyRules.bulkOrderCreated?'#25D366':'#9CA3AF'}}>WhatsApp {waConnected?waNotifyRules.bulkOrderCreated?'(All Engineers)':'Off':'Not Connected'}</span>
              {!waConnected&&<button onClick={()=>{setShowBulkOrder(false);setPage('whatsapp');}} style={{background:'none',border:'none',color:'#2563EB',fontSize:10,cursor:'pointer',textDecoration:'underline'}}>Connect</button>}
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:10}}><button className="bp" onClick={handleBulkSubmit} style={{flex:1}}><Layers size={14}/> Create Bulk Order & Notify ({bulkItems.filter(i=>i.materialNo&&i.description).length} items)</button><button className="bs" onClick={()=>setShowBulkOrder(false)}>Cancel</button></div>
      </div></div>}

      {/* ═══ ORDER DETAIL MODAL ═══ */}
      {selectedOrder&&<div className="mo" onClick={()=>setSelectedOrder(null)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:560,maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><div><h2 style={{fontSize:17,fontWeight:700}}>{selectedOrder.description}</h2><span className="mono" style={{fontSize:12,color:'#94A3B8'}}>{selectedOrder.id} • {selectedOrder.materialNo||'—'}</span></div><button onClick={()=>setSelectedOrder(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <Badge status={selectedOrder.status}/>

        {/* Ordered By & Month Badge - Prominent Display */}
        <div style={{display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}>
          {selectedOrder.orderBy&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#DBEAFE',borderRadius:8}}>
            <User size={14} color="#2563EB"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>ORDERED BY</div><div style={{fontSize:13,fontWeight:700,color:'#2563EB'}}>{selectedOrder.orderBy}</div></div>
          </div>}
          {selectedOrder.month&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#E6F4ED',borderRadius:8}}>
            <Calendar size={14} color="#0B7A3E"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>MONTH BATCH</div><div style={{fontSize:13,fontWeight:700,color:'#0B7A3E'}}>{String(selectedOrder.month).replace('_',' ')}</div></div>
          </div>}
          {selectedOrder.orderDate&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#F8FAFB',borderRadius:8}}>
            <Clock size={14} color="#64748B"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>ORDER DATE</div><div style={{fontSize:13,fontWeight:700,color:'#374151'}}>{fmtDate(selectedOrder.orderDate)}</div></div>
          </div>}
        </div>

        {selectedOrder.materialNo&&catalogLookup[selectedOrder.materialNo]&&<div style={{padding:12,borderRadius:8,background:'#EFF6FF',border:'1px solid #BFDBFE',marginTop:12,fontSize:12}}><strong style={{color:'#2563EB'}}>Catalog Price ({priceConfig.year})</strong><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}><div>SG: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].sg)}</strong></div><div>Dist: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].dist)}</strong></div><div>TP: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].tp)}</strong></div></div></div>}

        {/* Update Received Quantity Section */}
        <div style={{padding:16,borderRadius:10,background:'#F0FDF4',border:'1px solid #BBF7D0',marginTop:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><Package size={16} color="#059669"/><span style={{fontWeight:600,fontSize:13,color:'#059669'}}>Update Received Quantity</span></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,alignItems:'end'}}>
            <div>
              <label style={{display:'block',fontSize:11,color:'#64748B',marginBottom:4}}>Ordered</label>
              <div className="mono" style={{fontSize:18,fontWeight:700}}>{selectedOrder.quantity}</div>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,color:'#64748B',marginBottom:4}}>Received</label>
              <input type="number" min="0" max={selectedOrder.quantity||0} value={selectedOrder.qtyReceived||0} onChange={e=>{
                const val = parseInt(e.target.value)||0;
                const newBackOrder = val - selectedOrder.quantity;
                const newStatus = val >= selectedOrder.quantity ? 'Received' : val > 0 ? 'Back Order' : 'Pending';
                const updatedOrder = {...selectedOrder, qtyReceived: val, backOrder: newBackOrder, status: newStatus, arrivalDate: val > 0 ? (selectedOrder.arrivalDate || new Date().toISOString().slice(0,10)) : selectedOrder.arrivalDate};
                setOrders(prev=>prev.map(o=>o.id===selectedOrder.id ? updatedOrder : o));
                setSelectedOrder(updatedOrder);
              }} style={{width:'100%',padding:'8px 12px',fontSize:16,fontWeight:600,borderRadius:8,border:'1.5px solid #BBF7D0',textAlign:'center'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,color:'#64748B',marginBottom:4}}>Back Order</label>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:selectedOrder.backOrder<0?'#DC2626':'#059669'}}>{selectedOrder.backOrder<0?selectedOrder.backOrder:'✓ Full'}</div>
            </div>
          </div>
          {selectedOrder.backOrder<0 && <div style={{marginTop:12,padding:8,background:'#FEF2F2',borderRadius:6,fontSize:11,color:'#DC2626',display:'flex',alignItems:'center',gap:6}}><AlertCircle size={12}/> {Math.abs(selectedOrder.backOrder)} items still pending</div>}
          {selectedOrder.qtyReceived>=selectedOrder.quantity && <div style={{marginTop:12,padding:8,background:'#D1FAE5',borderRadius:6,fontSize:11,color:'#059669',display:'flex',alignItems:'center',gap:6}}><CheckCircle size={12}/> Order fully received</div>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:14}}>{[{l:'Price',v:selectedOrder.listPrice>0?fmt(selectedOrder.listPrice):'—'},{l:'Total',v:selectedOrder.totalCost>0?fmt(selectedOrder.totalCost):'—'},{l:'Ordered',v:fmtDate(selectedOrder.orderDate)},{l:'By',v:selectedOrder.orderBy||'—'},{l:'Arrival',v:selectedOrder.arrivalDate?fmtDate(selectedOrder.arrivalDate):'—'},{l:'Engineer',v:selectedOrder.engineer||'—'},{l:'Month',v:selectedOrder.month?.replace('_',' ')||'—'},{l:'Remark',v:selectedOrder.remark||'—'}].map((f,i)=><div key={i} style={{padding:10,borderRadius:8,background:'#F8FAFB'}}><div style={{fontSize:10,color:'#94A3B8',fontWeight:600,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{f.l}</div><div style={{fontSize:13,fontWeight:600}}>{f.v}</div></div>)}</div>
        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button className="bp" onClick={()=>{notify('Order Updated',`${selectedOrder.id} saved`,'success');setSelectedOrder(null);}}><Check size={14}/> Save & Close</button>
          <button className="be" onClick={()=>{notify('Email Sent','Update sent','success');setSelectedOrder(null);}}><Mail size={14}/> Email</button>
          {waConnected&&<button className="bw" onClick={()=>{notify('WhatsApp Sent','Alert sent','success');setSelectedOrder(null);}}><MessageSquare size={14}/> WhatsApp</button>}
          <button className="bs" onClick={()=>setSelectedOrder(null)}>Cancel</button>
        </div>
      </div></div>}

      {/* ═══ PART DETAIL MODAL ═══ */}
      {selectedPart&&<div className="mo" onClick={()=>setSelectedPart(null)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:520,maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><div><h2 style={{fontSize:17,fontWeight:700}}>{selectedPart.description}</h2><span className="mono" style={{fontSize:12,color:'#94A3B8'}}>{selectedPart.materialNo}</span></div><button onClick={()=>setSelectedPart(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <div style={{marginBottom:14}}><Pill bg={`${CATEGORIES[selectedPart.category]?.color||'#64748B'}12`} color={CATEGORIES[selectedPart.category]?.color||'#64748B'}>{CATEGORIES[selectedPart.category]?.label||selectedPart.category}</Pill></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>{[{l:'SG Price',v:fmt(selectedPart.singaporePrice),c:'#0B7A3E'},{l:'Dist Price',v:fmt(selectedPart.distributorPrice),c:'#2563EB'},{l:'Transfer (SGD)',v:fmt(selectedPart.transferPrice),c:'#7C3AED'},{l:'RSP (EUR)',v:`€${selectedPart.rspEur?.toLocaleString()}`,c:'#D97706'},{l:'Margin',v:`${selectedPart.singaporePrice>0?((selectedPart.singaporePrice-selectedPart.distributorPrice)/selectedPart.singaporePrice*100).toFixed(1):0}%`,c:'#059669'},{l:'Year',v:priceConfig.year,c:'#64748B'}].map((f,i)=><div key={i} style={{padding:12,borderRadius:8,background:'#F8FAFB'}}><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{f.l}</div><div className="mono" style={{fontSize:16,fontWeight:700,color:f.c}}>{f.v}</div></div>)}</div>
        <div style={{display:'flex',gap:10}}><button className="bp" onClick={()=>{setShowNewOrder(true);setNewOrder({materialNo:selectedPart.materialNo,description:selectedPart.description,quantity:1,listPrice:selectedPart.transferPrice,orderBy:'Fu Siong',remark:''});setSelectedPart(null);}}><ShoppingCart size={14}/> Order</button><button className="bs" onClick={()=>setSelectedPart(null)}>Close</button></div>
      </div></div>}

      {/* ═══════════ AI CHAT PANEL (SLIDE-IN) ═══════════ */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: aiPanelOpen ? 0 : -400,
        width: 380,
        height: '100vh',
        background: '#fff',
        boxShadow: aiPanelOpen ? '-4px 0 20px rgba(0,0,0,0.1)' : 'none',
        transition: 'right 0.3s ease',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans', system-ui, sans-serif"
      }}>
        {/* Panel Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #006837, #00A550)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} color="#fff"/>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Miltenyi Inventory Bot</div>
            </div>
          </div>
          <button onClick={() => setAiPanelOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <X size={16} color="#fff"/>
          </button>
        </div>

        {/* Messages Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#F8FAFB' }}>
          {aiMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #006837, #00A550)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Sparkles size={28} color="#fff"/>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A202C', marginBottom: 8 }}>How can I help?</h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{aiBotConfig.greeting}</p>
            </div>
          )}

          {aiMessages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 12, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #006837, #00A550)' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#1A202C',
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7, textAlign: 'right' }}>{msg.time}</div>
              </div>
            </div>
          ))}

          {aiProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fff', borderRadius: 14, width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} color="#0B7A3E"/>
              <span style={{ fontSize: 12, color: '#64748B' }}>Thinking...</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #E8ECF0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'price', label: 'Check Price', icon: DollarSign },
            { key: 'status', label: 'Order Status', icon: Package },
            { key: 'order', label: 'Place Order', icon: ShoppingCart },
            { key: 'stock', label: 'Stock Levels', icon: Database }
          ].map(action => (
            <button key={action.key} onClick={() => handleAiQuickAction(action.key)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 16,
              border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, color: '#64748B',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s'
            }} onMouseOver={e => { e.currentTarget.style.borderColor = '#0B7A3E'; e.currentTarget.style.color = '#0B7A3E'; }}
               onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}>
              <action.icon size={12}/> {action.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ padding: 16, borderTop: '1px solid #E8ECF0', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiSend()}
              placeholder="Ask about prices, orders, stock..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={handleAiSend} disabled={!aiInput.trim() || aiProcessing} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none',
              background: aiInput.trim() ? 'linear-gradient(135deg, #006837, #00A550)' : '#E2E8F0',
              color: aiInput.trim() ? '#fff' : '#94A3B8', cursor: aiInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Send size={16}/>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
