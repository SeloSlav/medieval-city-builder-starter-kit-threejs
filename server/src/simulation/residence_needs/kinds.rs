#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub enum ResidenceNeedKind {
    Firewood,
    Water,
    Food,
    Ale,
    PreservedFood,
}

impl ResidenceNeedKind {
    pub const ALL: [ResidenceNeedKind; 5] = [
        Self::Firewood,
        Self::Water,
        Self::Food,
        Self::PreservedFood,
        Self::Ale,
    ];

    pub fn is_active_for_tier(self, tier: u8) -> bool {
        match self {
            Self::Firewood | Self::Water | Self::Food => true,
            Self::PreservedFood => tier >= 2,
            Self::Ale => tier >= 3,
        }
    }

    pub fn as_u8(self) -> u8 {
        match self {
            Self::Firewood => 0,
            Self::Water => 1,
            Self::Food => 2,
            Self::Ale => 6,
            Self::PreservedFood => 7,
        }
    }

    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Firewood),
            1 => Some(Self::Water),
            2 => Some(Self::Food),
            6 => Some(Self::Ale),
            7 => Some(Self::PreservedFood),
            _ => None,
        }
    }
}
