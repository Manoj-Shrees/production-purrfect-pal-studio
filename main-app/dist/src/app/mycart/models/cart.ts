export interface cart {
    ID: number;
    name: string;
    price: number;
    pet_quantity: number;
    additional_fee: number;
    art_style: string;
    artist_additional_notes: string;
    background_additional_notes: string;
    background_style: string;
    petname: string;
    subject_type?: 'pet' | 'yourself' | 'both' | 'family' | 'vehicle' | 'house';  // optional — defaults to 'pet' for old records
    urls: {
    petimg1: string;
    petimg2: string;
    petimg3: string;
    petimg4: string;
    custombackgroundimg: string;
    personimg: string;   // ← add this
    };
    User_ID: number;
}