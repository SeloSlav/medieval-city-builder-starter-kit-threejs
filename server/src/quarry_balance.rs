pub fn preserve_extracted_stone(
    existing_max_yield: f64,
    existing_remaining: f64,
    new_max_yield: f64,
) -> f64 {
    let extracted = (existing_max_yield - existing_remaining).max(0.0);
    (new_max_yield - extracted).clamp(0.0, new_max_yield)
}

#[cfg(test)]
mod tests {
    use super::preserve_extracted_stone;

    #[test]
    fn expanded_deposits_keep_the_amount_already_extracted() {
        assert_eq!(preserve_extracted_stone(1500.0, 500.0, 10000.0), 9000.0);
        assert_eq!(preserve_extracted_stone(650.0, 0.0, 4000.0), 3350.0);
    }

    #[test]
    fn repeated_bootstrap_is_stable() {
        assert_eq!(preserve_extracted_stone(10000.0, 9000.0, 10000.0), 9000.0);
    }

    #[test]
    fn smaller_deposits_never_create_negative_remaining_stone() {
        assert_eq!(preserve_extracted_stone(10000.0, 9000.0, 650.0), 0.0);
    }
}
