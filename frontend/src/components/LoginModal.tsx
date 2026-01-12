// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi, userApi } from '../services/api';
import { elegantFirebasePhoneAuth } from '../services/firebasePhoneAuthElegant';
import { firebasePhoneAuth } from '../services/firebasePhoneAuth';
import { X, Phone, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react';
import logoImage from '../assets/neoabhro_logo_transparent.PNG';

// Country code data with phone formatting patterns
const countryData = [
  { code: '+91', country: 'India', flag: '🇮🇳', format: 'XXXXX XXXXX', maxLength: 10 },
  { code: '+1', country: 'United States', flag: '🇺🇸', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', format: 'XXXX XXX XXX', maxLength: 10 },
  { code: '+86', country: 'China', flag: '🇨🇳', format: 'XXX XXXX XXXX', maxLength: 11 },
  { code: '+81', country: 'Japan', flag: '🇯🇵', format: 'XX XXXX XXXX', maxLength: 10 },
  { code: '+49', country: 'Germany', flag: '🇩🇪', format: 'XXX XXXXXXX', maxLength: 11 },
  { code: '+33', country: 'France', flag: '🇫🇷', format: 'X XX XX XX XX', maxLength: 9 },
  { code: '+61', country: 'Australia', flag: '🇦🇺', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', format: 'XX XXXXX XXXX', maxLength: 11 },
  { code: '+52', country: 'Mexico', flag: '🇲🇽', format: 'XX XXXX XXXX', maxLength: 10 },
  { code: '+971', country: 'UAE', flag: '🇦🇪', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', format: 'XX-XXX XXXX', maxLength: 10 },
  { code: '+66', country: 'Thailand', flag: '🇹🇭', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳', format: 'XXX XXX XXXX', maxLength: 9 },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', format: 'XX XXXX XXXX', maxLength: 10 },
  { code: '+7', country: 'Russia', flag: '🇷🇺', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+39', country: 'Italy', flag: '🇮🇹', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+34', country: 'Spain', flag: '🇪🇸', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+46', country: 'Sweden', flag: '🇸🇪', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+47', country: 'Norway', flag: '🇳🇴', format: 'XXX XX XXX', maxLength: 8 },
  { code: '+45', country: 'Denmark', flag: '🇩🇰', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+358', country: 'Finland', flag: '🇫🇮', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭', format: 'XX XXX XX XX', maxLength: 9 },
  { code: '+43', country: 'Austria', flag: '🇦🇹', format: 'XXX XXXXXXX', maxLength: 10 },
  { code: '+32', country: 'Belgium', flag: '🇧🇪', format: 'XXX XX XX XX', maxLength: 9 },
  { code: '+351', country: 'Portugal', flag: '🇵🇹', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+30', country: 'Greece', flag: '🇬🇷', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+20', country: 'Egypt', flag: '🇪🇬', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+233', country: 'Ghana', flag: '🇬🇭', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+212', country: 'Morocco', flag: '🇲🇦', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+213', country: 'Algeria', flag: '🇩🇿', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+218', country: 'Libya', flag: '🇱🇾', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+220', country: 'Gambia', flag: '🇬🇲', format: 'XXX XXXX', maxLength: 7 },
  { code: '+221', country: 'Senegal', flag: '🇸🇳', format: 'XX XXX XX XX', maxLength: 9 },
  { code: '+222', country: 'Mauritania', flag: '🇲🇷', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+223', country: 'Mali', flag: '🇲🇱', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+224', country: 'Guinea', flag: '🇬🇳', format: 'XXX XX XX XX', maxLength: 9 },
  { code: '+225', country: 'Ivory Coast', flag: '🇨🇮', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+227', country: 'Niger', flag: '🇳🇪', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+228', country: 'Togo', flag: '🇹🇬', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+229', country: 'Benin', flag: '🇧🇯', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+230', country: 'Mauritius', flag: '🇲🇺', format: 'XXXX XXXX', maxLength: 7 },
  { code: '+231', country: 'Liberia', flag: '🇱🇷', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+232', country: 'Sierra Leone', flag: '🇸🇱', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+235', country: 'Chad', flag: '🇹🇩', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+236', country: 'Central African Republic', flag: '🇨🇫', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+237', country: 'Cameroon', flag: '🇨🇲', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+238', country: 'Cape Verde', flag: '🇨🇻', format: 'XXX XXXX', maxLength: 7 },
  { code: '+239', country: 'São Tomé and Príncipe', flag: '🇸🇹', format: 'XX XXXX', maxLength: 6 },
  { code: '+240', country: 'Equatorial Guinea', flag: '🇬🇶', format: 'XXX XXX', maxLength: 6 },
  { code: '+241', country: 'Gabon', flag: '🇬🇦', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+242', country: 'Republic of the Congo', flag: '🇨🇬', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+243', country: 'Democratic Republic of the Congo', flag: '🇨🇩', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+244', country: 'Angola', flag: '🇦🇴', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼', format: 'XXX XXXX', maxLength: 7 },
  { code: '+246', country: 'British Indian Ocean Territory', flag: '🇮🇴', format: 'XXX XXXX', maxLength: 7 },
  { code: '+248', country: 'Seychelles', flag: '🇸🇨', format: 'X XXX XXX', maxLength: 7 },
  { code: '+249', country: 'Sudan', flag: '🇸🇩', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+252', country: 'Somalia', flag: '🇸🇴', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+253', country: 'Djibouti', flag: '🇩🇯', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+256', country: 'Uganda', flag: '🇺🇬', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+257', country: 'Burundi', flag: '🇧🇮', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+258', country: 'Mozambique', flag: '🇲🇿', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+260', country: 'Zambia', flag: '🇿🇲', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+261', country: 'Madagascar', flag: '🇲🇬', format: 'XX XX XXX XX', maxLength: 9 },
  { code: '+262', country: 'Réunion', flag: '🇷🇪', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+263', country: 'Zimbabwe', flag: '🇿🇼', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+264', country: 'Namibia', flag: '🇳🇦', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+265', country: 'Malawi', flag: '🇲🇼', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+266', country: 'Lesotho', flag: '🇱🇸', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+267', country: 'Botswana', flag: '🇧🇼', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+268', country: 'Swaziland', flag: '🇸🇿', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+269', country: 'Comoros', flag: '🇰🇲', format: 'XXX XXXX', maxLength: 7 },
  { code: '+290', country: 'Saint Helena', flag: '🇸🇭', format: 'XXXX', maxLength: 4 },
  { code: '+291', country: 'Eritrea', flag: '🇪🇷', format: 'X XXX XXX', maxLength: 7 },
  { code: '+297', country: 'Aruba', flag: '🇦🇼', format: 'XXX XXXX', maxLength: 7 },
  { code: '+298', country: 'Faroe Islands', flag: '🇫🇴', format: 'XXXXXX', maxLength: 6 },
  { code: '+299', country: 'Greenland', flag: '🇬🇱', format: 'XX XX XX', maxLength: 6 },
  { code: '+350', country: 'Gibraltar', flag: '🇬🇮', format: 'XXXXXX', maxLength: 6 },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+353', country: 'Ireland', flag: '🇮🇪', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+354', country: 'Iceland', flag: '🇮🇸', format: 'XXX XXXX', maxLength: 7 },
  { code: '+355', country: 'Albania', flag: '🇦🇱', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+356', country: 'Malta', flag: '🇲🇹', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+357', country: 'Cyprus', flag: '🇨🇾', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+358', country: 'Finland', flag: '🇫🇮', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+359', country: 'Bulgaria', flag: '🇧🇬', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹', format: 'XXX XXXXX', maxLength: 8 },
  { code: '+371', country: 'Latvia', flag: '🇱🇻', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+372', country: 'Estonia', flag: '🇪🇪', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+373', country: 'Moldova', flag: '🇲🇩', format: 'XXX XXX XX', maxLength: 8 },
  { code: '+374', country: 'Armenia', flag: '🇦🇲', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+375', country: 'Belarus', flag: '🇧🇾', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+376', country: 'Andorra', flag: '🇦🇩', format: 'XXX XXX', maxLength: 6 },
  { code: '+377', country: 'Monaco', flag: '🇲🇨', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+378', country: 'San Marino', flag: '🇸🇲', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+381', country: 'Serbia', flag: '🇷🇸', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+382', country: 'Montenegro', flag: '🇲🇪', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+383', country: 'Kosovo', flag: '🇽🇰', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+385', country: 'Croatia', flag: '🇭🇷', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+386', country: 'Slovenia', flag: '🇸🇮', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+387', country: 'Bosnia and Herzegovina', flag: '🇧🇦', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+389', country: 'North Macedonia', flag: '🇲🇰', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+421', country: 'Slovakia', flag: '🇸🇰', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+423', country: 'Liechtenstein', flag: '🇱🇮', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+500', country: 'Falkland Islands', flag: '🇫🇰', format: 'XXXXX', maxLength: 5 },
  { code: '+501', country: 'Belize', flag: '🇧🇿', format: 'XXX XXXX', maxLength: 7 },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+504', country: 'Honduras', flag: '🇭🇳', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+507', country: 'Panama', flag: '🇵🇦', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+508', country: 'Saint Pierre and Miquelon', flag: '🇵🇲', format: 'XXX XXX', maxLength: 6 },
  { code: '+509', country: 'Haiti', flag: '🇭🇹', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+590', country: 'Guadeloupe', flag: '🇬🇵', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+592', country: 'Guyana', flag: '🇬🇾', format: 'XXX XXXX', maxLength: 7 },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+594', country: 'French Guiana', flag: '🇬🇫', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+596', country: 'Martinique', flag: '🇲🇶', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+597', country: 'Suriname', flag: '🇸🇷', format: 'XXX XXXX', maxLength: 7 },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+599', country: 'Netherlands Antilles', flag: '🇳🇱', format: 'XXX XXXX', maxLength: 7 },
  { code: '+670', country: 'East Timor', flag: '🇹🇱', format: 'XXX XXXX', maxLength: 7 },
  { code: '+672', country: 'Antarctica', flag: '🇦🇶', format: 'XXX XXX', maxLength: 6 },
  { code: '+673', country: 'Brunei', flag: '🇧🇳', format: 'XXX XXXX', maxLength: 7 },
  { code: '+674', country: 'Nauru', flag: '🇳🇷', format: 'XXX XXXX', maxLength: 7 },
  { code: '+675', country: 'Papua New Guinea', flag: '🇵🇬', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+676', country: 'Tonga', flag: '🇹🇴', format: 'XXXXX', maxLength: 5 },
  { code: '+677', country: 'Solomon Islands', flag: '🇸🇧', format: 'XXXXX', maxLength: 5 },
  { code: '+678', country: 'Vanuatu', flag: '🇻🇺', format: 'XXXXX', maxLength: 5 },
  { code: '+679', country: 'Fiji', flag: '🇫🇯', format: 'XXXX XXX', maxLength: 7 },
  { code: '+680', country: 'Palau', flag: '🇵🇼', format: 'XXX XXXX', maxLength: 7 },
  { code: '+681', country: 'Wallis and Futuna', flag: '🇼🇫', format: 'XX XXXX', maxLength: 6 },
  { code: '+682', country: 'Cook Islands', flag: '🇨🇰', format: 'XXXXX', maxLength: 5 },
  { code: '+683', country: 'Niue', flag: '🇳🇺', format: 'XXXX', maxLength: 4 },
  { code: '+684', country: 'American Samoa', flag: '🇦🇸', format: 'XXX XXXX', maxLength: 7 },
  { code: '+685', country: 'Samoa', flag: '🇼🇸', format: 'XXXXX', maxLength: 5 },
  { code: '+686', country: 'Kiribati', flag: '🇰🇮', format: 'XXXXX', maxLength: 5 },
  { code: '+687', country: 'New Caledonia', flag: '🇳🇨', format: 'XXX XXX', maxLength: 6 },
  { code: '+688', country: 'Tuvalu', flag: '🇹🇻', format: 'XXXXX', maxLength: 5 },
  { code: '+689', country: 'French Polynesia', flag: '🇵🇫', format: 'XX XX XX', maxLength: 6 },
  { code: '+690', country: 'Tokelau', flag: '🇹🇰', format: 'XXXX', maxLength: 4 },
  { code: '+691', country: 'Micronesia', flag: '🇫🇲', format: 'XXX XXXX', maxLength: 7 },
  { code: '+692', country: 'Marshall Islands', flag: '🇲🇭', format: 'XXX XXXX', maxLength: 7 },
  { code: '+850', country: 'North Korea', flag: '🇰🇵', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+853', country: 'Macau', flag: '🇲🇴', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+855', country: 'Cambodia', flag: '🇰🇭', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+856', country: 'Laos', flag: '🇱🇦', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', format: 'XXXXX XXXXX', maxLength: 10 },
  { code: '+886', country: 'Taiwan', flag: '🇹🇼', format: 'XX XXXX XXXX', maxLength: 9 },
  { code: '+960', country: 'Maldives', flag: '🇲🇻', format: 'XXX XXXX', maxLength: 7 },
  { code: '+961', country: 'Lebanon', flag: '🇱🇧', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+962', country: 'Jordan', flag: '🇯🇴', format: 'X XXXX XXXX', maxLength: 9 },
  { code: '+963', country: 'Syria', flag: '🇸🇾', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+964', country: 'Iraq', flag: '🇮🇶', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+967', country: 'Yemen', flag: '🇾🇪', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+968', country: 'Oman', flag: '🇴🇲', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+970', country: 'Palestine', flag: '🇵🇸', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+971', country: 'UAE', flag: '🇦🇪', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+972', country: 'Israel', flag: '🇮🇱', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', format: 'XXXX XXXX', maxLength: 8 },
  { code: '+975', country: 'Bhutan', flag: '🇧🇹', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+976', country: 'Mongolia', flag: '🇲🇳', format: 'XX XX XX XX', maxLength: 8 },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+992', country: 'Tajikistan', flag: '🇹🇯', format: 'XX XXX XXXX', maxLength: 9 },
  { code: '+993', country: 'Turkmenistan', flag: '🇹🇲', format: 'XX XXX XXX', maxLength: 8 },
  { code: '+994', country: 'Azerbaijan', flag: '🇦🇿', format: 'XX XXX XX XX', maxLength: 9 },
  { code: '+995', country: 'Georgia', flag: '🇬🇪', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+996', country: 'Kyrgyzstan', flag: '🇰🇬', format: 'XXX XXX XXX', maxLength: 9 },
  { code: '+998', country: 'Uzbekistan', flag: '🇺🇿', format: 'XX XXX XXXX', maxLength: 9 }
];

// Get user's country based on timezone
const getUserCountry = () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const countryMap: { [key: string]: string } = {
    'Asia/Kolkata': '+91',
    'America/New_York': '+1',
    'America/Chicago': '+1',
    'America/Denver': '+1',
    'America/Los_Angeles': '+1',
    'Europe/London': '+44',
    'Europe/Paris': '+33',
    'Europe/Berlin': '+49',
    'Asia/Tokyo': '+81',
    'Asia/Shanghai': '+86',
    'Australia/Sydney': '+61',
    'America/Sao_Paulo': '+55',
    'America/Mexico_City': '+52',
    'Asia/Dubai': '+971',
    'Asia/Riyadh': '+966',
    'Asia/Singapore': '+65',
    'Asia/Kuala_Lumpur': '+60',
    'Asia/Bangkok': '+66',
    'Asia/Manila': '+63',
    'Asia/Ho_Chi_Minh': '+84',
    'Asia/Seoul': '+82',
    'Europe/Moscow': '+7',
    'Europe/Rome': '+39',
    'Europe/Madrid': '+34',
    'Europe/Amsterdam': '+31',
    'Europe/Stockholm': '+46',
    'Europe/Oslo': '+47',
    'Europe/Copenhagen': '+45',
    'Europe/Helsinki': '+358',
    'Europe/Zurich': '+41',
    'Europe/Vienna': '+43',
    'Europe/Brussels': '+32',
    'Europe/Lisbon': '+351',
    'Europe/Athens': '+30',
    'Europe/Istanbul': '+90',
    'Africa/Cairo': '+20',
    'Africa/Johannesburg': '+27',
    'Africa/Lagos': '+234',
    'Africa/Nairobi': '+254',
    'Africa/Accra': '+233',
    'Africa/Casablanca': '+212',
    'Africa/Algiers': '+213',
    'Africa/Tunis': '+216',
    'Africa/Tripoli': '+218',
    'Africa/Banjul': '+220',
    'Africa/Dakar': '+221',
    'Africa/Nouakchott': '+222',
    'Africa/Bamako': '+223',
    'Africa/Conakry': '+224',
    'Africa/Abidjan': '+225',
    'Africa/Ouagadougou': '+226',
    'Africa/Niamey': '+227',
    'Africa/Lome': '+228',
    'Africa/Porto-Novo': '+229',
    'Africa/Port_Louis': '+230',
    'Africa/Monrovia': '+231',
    'Africa/Freetown': '+232',
    'Africa/Ndjamena': '+235',
    'Africa/Bangui': '+236',
    'Africa/Douala': '+237',
    'Africa/Praia': '+238',
    'Africa/Sao_Tome': '+239',
    'Africa/Malabo': '+240',
    'Africa/Libreville': '+241',
    'Africa/Brazzaville': '+242',
    'Africa/Kinshasa': '+243',
    'Africa/Luanda': '+244',
    'Africa/Bissau': '+245',
    'Africa/Mogadishu': '+252',
    'Africa/Djibouti': '+253',
    'Africa/Dar_es_Salaam': '+255',
    'Africa/Kampala': '+256',
    'Africa/Bujumbura': '+257',
    'Africa/Maputo': '+258',
    'Africa/Lusaka': '+260',
    'Africa/Antananarivo': '+261',
    'Africa/Harare': '+263',
    'Africa/Windhoek': '+264',
    'Africa/Blantyre': '+265',
    'Africa/Maseru': '+266',
    'Africa/Gaborone': '+267',
    'Africa/Mbabane': '+268',
    'Africa/Moroni': '+269',
    'Africa/Asmara': '+291',
    'Africa/Addis_Ababa': '+251',
    'Africa/Kigali': '+250',
    'Africa/Khartoum': '+249'
  };
  
  return countryMap[timezone] || '+91'; // Default to India if not found
};

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, signup, checkAuthState, setAuthData } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const defaultCountryCode = getUserCountry();
    return countryData.find(c => c.code === defaultCountryCode) || countryData[0];
  });
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  
  // Firebase Phone Auth state
  const [firebaseConfirmationResult, setFirebaseConfirmationResult] = useState<any>(null);
  const [useFirebaseAuth, setUseFirebaseAuth] = useState(true); // Use Firebase Phone Auth by default
  
  // Smart Authentication Strategy state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [requiresOTP, setRequiresOTP] = useState(false);
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  // Registration flow state management
  const [registrationStep, setRegistrationStep] = useState<'phone' | 'otp' | 'pin' | 'register' | 'success'>('phone');
  const [phoneEditable, setPhoneEditable] = useState(true);
  const [otpVerified, setOtpVerified] = useState(false);
  
  // Refs for PIN input boxes
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup Firebase Phone Auth on unmount
  useEffect(() => {
    return () => {
      elegantFirebasePhoneAuth.cleanup();
    };
  }, []);

  // Reset registration flow when switching between login/signup
  useEffect(() => {
    if (isSignup) {
      setRegistrationStep('phone');
      setPhoneEditable(true);
      setOtpVerified(false);
      setShowOtp(false);
      setOtp('');
      setPin(['', '', '', '']);
      setError('');
    } else {
      setRegistrationStep('phone');
      setPhoneEditable(true);
      setOtpVerified(false);
      setShowOtp(false);
      setOtp('');
      setPin(['', '', '', '']);
      setError('');
    }
  }, [isSignup]);

  // Cleanup Firebase Phone Auth when component unmounts
  useEffect(() => {
    return () => {
      if (useFirebaseAuth) {
        firebasePhoneAuth.cleanup();
      }
    };
  }, [useFirebaseAuth]);

  // Format phone number based on selected country
  const formatPhoneNumber = (value: string, country: typeof countryData[0]) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    
    const format = country.format;
    let formatted = '';
    let digitIndex = 0;
    
    for (let i = 0; i < format.length && digitIndex < digits.length; i++) {
      if (format[i] === 'X') {
        formatted += digits[digitIndex];
        digitIndex++;
      } else {
        formatted += format[i];
      }
    }
    
    return formatted;
  };

  // Handle phone number input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPhoneNumber(value, selectedCountry);
    setPhone(formatted);
    // Clear user lookup result when phone changes
    setUserLookupResult(null);
  };

  // Lookup user when phone number is 10 digits or more
  useEffect(() => {
    const lookupUser = async () => {
      if (phone.length >= 10 && phone.length === selectedCountry.maxLength) {
        setIsLookingUpUser(true);
        try {
          const fullPhoneNumber = getFullPhoneNumber();
          const userData = await userApi.getByPhone(fullPhoneNumber);
          
          if (userData && userData.user) {
            // Extract name and roles from user data
            const user = userData.user;
            const roles: string[] = [];
            
            // Extract roles from privileges if available
            if (user.privileges && Array.isArray(user.privileges)) {
              const aarogyaPrivilege = user.privileges.find((p: any) => p.platform === 'aarogya-mitra');
              if (aarogyaPrivilege && aarogyaPrivilege.roles) {
                roles.push(...aarogyaPrivilege.roles);
              }
            }
            
            setUserLookupResult({
              name: user.name || user.phone || 'User',
              roles: roles.length > 0 ? roles : (user.role ? [user.role] : [])
            });
          } else {
            setUserLookupResult(null);
          }
        } catch (error: any) {
          // User not found - this is expected for new users
          if (error.response?.status === 404) {
            setUserLookupResult(null);
          } else {
            console.error('Error looking up user:', error);
            setUserLookupResult(null);
          }
        } finally {
          setIsLookingUpUser(false);
        }
      } else {
        setUserLookupResult(null);
      }
    };

    // Debounce the lookup
    const timeoutId = setTimeout(lookupUser, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, selectedCountry.code, selectedCountry.maxLength]);

  // Handle PIN input
  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    
    // Auto-focus next box
    if (value && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  // Handle PIN backspace
  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste for PIN
  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length === 4) {
      const newPin = pastedData.split('');
      setPin(newPin);
      pinRefs.current[3]?.focus();
    }
  };

  // Get full phone number with country code
  const getFullPhoneNumber = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    return selectedCountry.code + cleanPhone;
  };


  // Handle forgot PIN
  const handleForgotPin = async () => {
    if (!phone) {
      setError('Please enter your phone number first');
      return;
    }

    setOtpLoading(true);
    setError('');
    
    try {
      const fullPhoneNumber = getFullPhoneNumber();
      
      // Always use Firebase Phone Auth for forgot PIN (no backend SMS)
      console.log('🔥 [FIREBASE PHONE AUTH] Forgot PIN - sending OTP via Firebase');
      
      const result = await firebasePhoneAuth.sendOTP(fullPhoneNumber);
      
      if (result.success && result.confirmationResult) {
        setFirebaseConfirmationResult(result.confirmationResult);
        setShowOtp(true);
        setError('✅ OTP sent for PIN reset. Enter OTP and new PIN.');
      } else {
        setError(result.message || 'Failed to send OTP for PIN reset');
      }
    } catch (err: any) {
      console.error('Forgot PIN error:', err);
      setError(err.message || 'Failed to send OTP for PIN reset');
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle PIN reset
  const handlePinReset = async () => {
    if (!phone || !otp || pin.join('').length !== 4) {
      setError('Please enter phone number, OTP, and new PIN');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const fullPhoneNumber = getFullPhoneNumber();
      const pinString = pin.join('');
      
      // Always verify OTP with Firebase first, then reset PIN via backend
      if (firebaseConfirmationResult) {
        const verifyResult = await firebasePhoneAuth.verifyOTP(firebaseConfirmationResult, otp);
        
        if (verifyResult.success) {
          // Reset PIN via backend
          await authApi.resetPin(fullPhoneNumber, otp, pinString);
          setError('✅ PIN reset successfully. You can now login with your new PIN.');
          setShowOtp(false);
          setOtp('');
          setPin(['', '', '', '']);
          setLoginAttempts(0);
          setShowForgotPin(false);
          setRequiresOTP(false);
          setAccountLocked(false);
        } else {
          setError(verifyResult.message || 'Invalid OTP');
        }
      } else {
        setError('Please send OTP first before resetting PIN');
      }
    } catch (err: any) {
      console.error('PIN reset error:', err);
      setError(err.message || 'Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    const fullPhoneNumber = getFullPhoneNumber();
    
    setOtpLoading(true);
    setError('');
    
    try {
      // Use the elegant Firebase Phone Auth solution
      console.log('🔥 [REGISTRATION STEP 1] Sending OTP to:', fullPhoneNumber);
      
      const result = await elegantFirebasePhoneAuth.sendOTP(fullPhoneNumber);
      
      if (result.success && result.confirmationResult) {
        setFirebaseConfirmationResult(result.confirmationResult);
        setError(`✅ ${result.message}`);
        console.log('✅ [REGISTRATION STEP 1] OTP sent successfully');
        
        // Move to OTP verification step
        setRegistrationStep('otp');
        setShowOtp(true);
        
        // Show test code for test numbers
        if (result.message.includes('Test OTP')) {
          console.log('🧪 [REGISTRATION STEP 1] Test mode - OTP code shown in message');
        }
      } else {
        // Firebase failed, try backend fallback
        console.log('⚠️ [REGISTRATION STEP 1] Firebase failed, trying backend fallback');
        setError('Firebase failed. Trying backend SMS service...');
        
        try {
          await authApi.sendOTP(fullPhoneNumber);
          setError('✅ OTP sent successfully via Backend SMS service!');
          console.log('✅ [REGISTRATION STEP 1] OTP sent successfully as fallback');
          
          // Move to OTP verification step even with backend SMS
          setRegistrationStep('otp');
      setShowOtp(true);
        } catch (backendErr) {
          setError(result.message || 'Failed to send OTP. Please try again.');
          console.error('❌ [REGISTRATION STEP 1] Also failed:', backendErr);
        }
      }
      
      setTimeout(() => setError(''), 8000);
    } catch (err: any) {
      console.error('❌ [REGISTRATION STEP 1] Error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!phone || !otp) {
      setError('Please enter phone number and OTP');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const fullPhoneNumber = getFullPhoneNumber();
      const pinString = pin.join('');
      
      // Verify OTP first
      let otpVerified = false;
      
      // Use elegant Firebase Phone Auth verification
      if (firebaseConfirmationResult) {
        console.log('🔥 [REGISTRATION STEP 2] Verifying OTP');
        
        const result = await elegantFirebasePhoneAuth.verifyOTP(firebaseConfirmationResult, otp);
        
        if (result.success) {
          console.log('✅ [REGISTRATION STEP 2] OTP verified successfully');
          otpVerified = true;
        } else {
          // Firebase verification failed, try backend verification
          console.log('⚠️ [REGISTRATION STEP 2] Verification failed, trying backend verification');
          
          try {
            await authApi.verifyOTP(fullPhoneNumber, otp);
            otpVerified = true;
            console.log('✅ [REGISTRATION STEP 2] OTP verified successfully as fallback');
          } catch (backendErr) {
            console.error('❌ [REGISTRATION STEP 2] Also failed:', backendErr);
          }
        }
      } else {
        // No Firebase confirmation result, use backend verification
        console.log('📱 [REGISTRATION STEP 2] Verifying OTP via backend SMS service');
        try {
          await authApi.verifyOTP(fullPhoneNumber, otp);
          otpVerified = true;
          console.log('✅ [REGISTRATION STEP 2] OTP verified successfully');
        } catch (err) {
          console.error('❌ [REGISTRATION STEP 2] Backend verification failed:', err);
        }
      }
      
      // If OTP verified, directly register the user
      if (otpVerified) {
        console.log('🔥 [REGISTRATION STEP 3] OTP verified, registering user with phone:', fullPhoneNumber);
        
        try {
          const response = await authApi.signup(fullPhoneNumber, pinString, otp);
          console.log('🔥 [REGISTRATION STEP 3] Backend response:', response);
          
          if (response && response.token) {
            // Success - auto-login and redirect
            console.log('✅ [REGISTRATION STEP 3] Registration successful, auto-login user');
            setError('✅ Registration successful! Logging you in...');
            
            // Store token and user data
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            
            // Update authentication state immediately using direct data
            console.log('🔄 [REGISTRATION] Calling setAuthData with:', { user: response.user, token: response.token });
            setAuthData(response.user, response.token);
            
            // Also call checkAuthState as a backup
            checkAuthState();
            
            // Force a small delay to ensure state is updated
            setTimeout(() => {
              console.log('🔄 [REGISTRATION] Closing modal after state update');
              onClose();
            }, 200);
          } else {
            console.log('❌ [REGISTRATION STEP 3] Registration failed - no token in response:', response);
            setError('❌ Registration failed. Please try again.');
          }
        } catch (regErr: any) {
          console.error('❌ [REGISTRATION STEP 3] Registration error:', regErr);
          
          // Handle specific error cases
          if (regErr.response?.status === 400) {
            const errorMessage = regErr.response.data?.message || '';
            
            if (errorMessage.includes('User already exists with this phone number') || errorMessage.includes('User already exists')) {
              setError('❌ Phone number already registered. Please login instead.');
              // Reset the form to login mode
              setTimeout(() => {
                setIsSignup(false);
                setRegistrationStep('phone');
                setOtpVerified(false);
                setShowOtp(false);
                setOtp('');
                setPin(['', '', '', '']);
                setError('');
              }, 3000);
            } else if (errorMessage.includes('Invalid or expired OTP')) {
              setError('❌ Invalid or expired OTP. Please try again.');
            } else if (errorMessage.includes('PIN must be exactly 4 digits')) {
              setError('❌ PIN must be exactly 4 digits.');
            } else {
              setError(`❌ ${errorMessage}`);
            }
          } else {
            setError('❌ Registration failed. Please try again.');
          }
        }
      } else {
        // OTP verification failed
        setError('❌ Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ [REGISTRATION STEP 2] Error:', err);
      setError('❌ Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhoneNumber = getFullPhoneNumber();
    const pinString = pin.join('');
    
    if (!phone || pinString.length !== 4) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      if (isSignup) {
        // Simplified Registration flow
        if (registrationStep === 'phone') {
          // Step 1: Send OTP when "Register User with Ph no." is clicked
          console.log('🔥 [REGISTRATION STEP 1] Sending OTP to:', fullPhoneNumber);
          
          try {
            const result = await elegantFirebasePhoneAuth.sendOTP(fullPhoneNumber);
            
            if (result.success && result.confirmationResult) {
              setFirebaseConfirmationResult(result.confirmationResult);
              setRegistrationStep('otp');
              setError(`✅ OTP has been sent to your number. Please enter the same.`);
              console.log('✅ [REGISTRATION STEP 1] OTP sent successfully');
            } else {
              // Firebase failed, try backend fallback
              console.log('⚠️ [REGISTRATION STEP 1] Firebase failed, trying backend fallback');
              setError('Firebase failed. Trying backend SMS service...');
              
              try {
                await authApi.sendOTP(fullPhoneNumber);
                setRegistrationStep('otp');
                setError('✅ OTP has been sent to your number. Please enter the same.');
                console.log('✅ [REGISTRATION STEP 1] OTP sent successfully as fallback');
              } catch (backendErr) {
                setError(result.message || 'Failed to send OTP. Please try again.');
                console.error('❌ [REGISTRATION STEP 1] Also failed:', backendErr);
              }
            }
          } catch (err: any) {
            console.error('❌ [REGISTRATION STEP 1] Error:', err);
            setError(err.message || 'Failed to send OTP. Please try again.');
          }
        }
      } else {
        // Login flow with smart authentication strategy
        try {
          const response = await authApi.login(fullPhoneNumber, pinString);
          
          if (response && response.token) {
            // Successful login
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            setLoginAttempts(0);
            setShowForgotPin(false);
            setRequiresOTP(false);
            setAccountLocked(false);
            
            // Update authentication state immediately using direct data
            console.log('🔄 [LOGIN] Calling setAuthData with:', { user: response.user, token: response.token });
            setAuthData(response.user, response.token);
            
            // Also call checkAuthState as a backup
            checkAuthState();
            
            // Force a small delay to ensure state is updated
            setTimeout(() => {
              console.log('🔄 [LOGIN] Closing modal after state update');
              onClose();
            }, 200);
          }
        } catch (err: any) {
          console.error('Login error:', err);
          
          if (err.response?.status === 423) {
            // Account locked
            setAccountLocked(true);
            setLockedUntil(new Date(err.response.data.lockedUntil));
            setRequiresOTP(true);
            setError(err.response.data.message);
          } else if (err.response?.status === 400) {
            // Failed login attempt
            const data = err.response.data;
            setLoginAttempts(data.attemptsRemaining || 0);
            setShowForgotPin(data.showForgotPin || false);
            setRequiresOTP(data.requiresOTP || false);
            setError(data.message);
          } else {
            setError('Login failed. Please try again.');
          }
        }
      }
    } catch (err: any) {
      console.error('❌ [SUBMIT] Error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <header className="glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <h1 className="text-2xl font-bold text-gradient">Aarogya Mitra</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
          <div className="flex flex-col items-center mb-6">
            {/* App Logo and Title */}
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src={logoImage} 
                alt="NeoAbhro Logo" 
                className="w-12 h-12 object-contain"
              />
              <div>
                <h2 className="text-xl font-bold text-white">Aarogya Mitra</h2>
                <p className="text-sm text-white/60">Classical Music Discovery</p>
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-gradient text-center">
            {isSignup ? 'Create Account' : 'Welcome Back'}
            </h3>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {!showOtp ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Phone Number
              </label>
              <div className="flex space-x-2">
                {/* Country Code Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="flex items-center space-x-2 px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors min-w-[120px] focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <span className="text-lg">{selectedCountry.flag}</span>
                    <span className="text-sm font-medium text-white">{selectedCountry.code}</span>
                    <ChevronDown className="w-4 h-4 text-white" />
                  </button>
                  
                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-300 shadow-xl z-50 max-h-60 overflow-y-auto">
                      {countryData.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setShowCountryDropdown(false);
                            setPhone(''); // Clear phone when country changes
                          }}
                          className="w-full flex flex-col items-center px-3 py-3 text-center hover:bg-gray-50 transition-colors"
                        >
                          {/* Flag and Code Row */}
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{country.flag}</span>
                            <span className="text-sm font-medium text-gray-900">{country.code}</span>
                          </div>
                          
                          {/* Country Name Row with Scroll */}
                          <div className="w-full overflow-x-auto scrollbar-hide">
                            <span className="text-xs text-gray-700 whitespace-nowrap block min-w-max">
                              {country.country}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Phone Number Input */}
                <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  type="tel"
                  value={phone}
                    onChange={handlePhoneChange}
                    placeholder={selectedCountry.format}
                    maxLength={selectedCountry.maxLength + 5} // Account for formatting characters
                    disabled={!phoneEditable}
                    className={`input-field pl-10 w-full text-white placeholder:text-white/50 ${
                      !phoneEditable ? 'bg-gray-500/20 border-gray-500/40 cursor-not-allowed' : ''
                    }`}
                  required
                />
                </div>
              </div>
              
              {/* User Lookup Result */}
              {phone.length >= 10 && (
                <div className="mt-2">
                  {isLookingUpUser ? (
                    <p className="text-xs text-white/60">Searching...</p>
                  ) : userLookupResult ? (
                    <div className="text-xs text-white/80">
                      <p className="font-medium">Name: {userLookupResult.name}</p>
                      {userLookupResult.roles && userLookupResult.roles.length > 0 && (
                        <p className="text-white/60">Roles: {userLookupResult.roles.join(', ')}</p>
                      )}
                    </div>
                  ) : phone.length === selectedCountry.maxLength ? (
                    <p className="text-xs text-red-300">Pl. register yourself</p>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                4-Digit PIN
              </label>
              <div className="flex space-x-3 justify-center">
                {pin.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => (pinRefs.current[index] = el)}
                  type={showPin ? 'text' : 'password'}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    onPaste={handlePinPaste}
                    maxLength={1}
                    inputMode="numeric"
                    className="w-12 h-12 text-center text-xl font-bold bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                ))}
              </div>
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="flex items-center space-x-2 text-sm text-white/60 hover:text-white transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPin ? 'Hide PIN' : 'Show PIN'}</span>
                </button>
              </div>
            </div>

            {/* OTP Verification Section - Only show for signup when not in initial step */}
            {isSignup && registrationStep !== 'phone' && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  OTP Verification
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="input-field text-center text-lg tracking-widest flex-1"
                    required
                  />
                  {registrationStep === 'otp' && (
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={loading || !otp}
                      className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      {loading ? 'Registering...' : 'Register User'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-white/60 mt-1 text-center">
                  {registrationStep === 'otp' ? 'OTP has been sent to your number. Please enter the same.' : 'Please verify your phone number with OTP'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isSignup && registrationStep === 'otp')}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : 
               isSignup ? 
                 (registrationStep === 'phone' ? 'Register User with Ph no.' : 'Complete Previous Steps') : 
                 'Login'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
              </button>
            </div>

            <div className="text-center">
              {/* Show Forgot PIN button only after 3 failed attempts or when OTP is required */}
              {(showForgotPin || requiresOTP || accountLocked) && (
              <button
                type="button"
                  onClick={handleForgotPin}
                  disabled={otpLoading}
                  className="text-sm text-secondary-300 hover:text-secondary-200 transition-colors disabled:opacity-50"
              >
                  {otpLoading ? 'Sending OTP...' : 'Forgot PIN? Reset with OTP'}
              </button>
              )}
              
              {/* Show login attempts info */}
              {loginAttempts > 0 && loginAttempts < 5 && (
                <p className="text-xs text-yellow-400 text-center">
                  {loginAttempts} attempts remaining
                </p>
              )}
              
              {/* Show account locked message */}
              {accountLocked && lockedUntil && (
                <p className="text-xs text-red-400 text-center">
                  Account locked until {lockedUntil.toLocaleTimeString()}
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="1234"
                maxLength={4}
                className="input-field text-center text-2xl tracking-widest"
              />
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              onClick={() => setShowOtp(false)}
              className="w-full text-sm text-white/60 hover:text-white transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
      </main>

      {/* Footer */}
      <footer className="glass-effect border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* NeoAbhro Text - Left */}
            <div className="text-sm font-semibold text-white">
              NeoAbhro
            </div>
            
            {/* Logo - Center */}
            <div className="flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="NeoAbhro Logo" 
                className="w-6 h-6 object-contain"
              />
            </div>
            
            {/* App Version - Right */}
            <p className="text-xs text-white/60">
              v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
            </p>
          </div>
        </div>
      </footer>
      
      {/* reCAPTCHA Container for Firebase Phone Auth */}
      <div id="recaptcha-container" className="hidden"></div>
    </div>
  );
};

export default LoginModal;
