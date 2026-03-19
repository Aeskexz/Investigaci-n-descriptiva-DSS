-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 22-02-2026 a las 20:45:17
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;



CREATE TABLE `citas` (
  `id` int(11) NOT NULL,
  `paciente` varchar(100) NOT NULL,
  `razon` text NOT NULL,
  `fecha` date NOT NULL,
  `hora` time NOT NULL,
  `doctor_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



INSERT INTO `citas` (`id`, `paciente`, `razon`, `fecha`, `hora`, `doctor_id`) VALUES
(1, 'carlos hernandez', 'mal estar fisico', '2026-02-20', '12:24:00', 1),
(2, 'ivan', 'sesientemalito', '2025-02-12', '12:24:00', 1),
(3, 'Fernando', 'mesiendomalito', '2026-02-20', '13:20:00', 2),
(5, 'jasdkjasdk', 'jajajajaxd', '2026-02-24', '14:14:00', 1),
(6, 'aesede', 'me siento mal generalmente en el corazón.', '2026-02-25', '12:27:00', 3),
(7, 'Carlos Rivera', 'nose', '2026-02-25', '17:26:00', 2),
(8, 'asd', 'pediatria', '2026-02-25', '16:33:00', 1);



CREATE TABLE `doctores` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `especialidad` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



INSERT INTO `doctores` (`id`, `nombre`, `especialidad`) VALUES
(1, 'Dr. Carlos Perez', 'Medicina General'),
(2, 'Dra. Ana Lopez', 'Pediatria'),
(3, 'Dr. Miguel Torres', 'Cardiologia');


ALTER TABLE `citas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `doctor_id` (`doctor_id`);


ALTER TABLE `doctores`
  ADD PRIMARY KEY (`id`);


ALTER TABLE `citas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;


ALTER TABLE `doctores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;


ALTER TABLE `citas`
  ADD CONSTRAINT `citas_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `doctores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
